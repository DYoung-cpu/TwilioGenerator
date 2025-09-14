const express = require('express');
const router = express.Router();
const { twilioClient, loanOfficers } = require('../config/twilio');
const { autoTranscribe, getTranscription, hasTranscription } = require('./auto-transcribe');

// In-memory storage for call data (in production, use a database)
const callDataStore = {};

// Route to initiate a call to loan officer
router.post('/call/:loanOfficerId', async (req, res) => {
  try {
    const { loanOfficerId } = req.params;
    const { customerPhone, customerName, customerEmail } = req.body;

    const loanOfficer = loanOfficers[loanOfficerId];
    if (!loanOfficer) {
      return res.status(404).json({ error: 'Loan officer not found' });
    }

    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    // Create a call that connects customer to loan officer
    // Customer hears message while loan officer's phone rings
    const call = await twilioClient.calls.create({
      twiml: `<Response>
        <Say voice="alice">We will be connecting you with ${loanOfficer.name} at LendWise Mortgage.</Say>
        <Dial timeout="30" record="record-from-answer-dual" recordingStatusCallback="${process.env.BASE_URL}/api/twilio/recording-status">
          ${loanOfficer.phoneNumber}
        </Dial>
      </Response>`,
      to: customerPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      statusCallback: `${process.env.BASE_URL}/api/twilio/call-status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    // Store customer data for this call
    callDataStore[call.sid] = {
      customerName: customerName || 'Unknown',
      customerPhone: customerPhone,
      customerEmail: customerEmail || '',
      loanOfficer: loanOfficer.name,
      loanOfficerPhone: loanOfficer.phoneNumber,
      startTime: new Date().toISOString()
    };

    res.json({
      success: true,
      callSid: call.sid,
      message: `Connecting you with ${loanOfficer.name}`
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ error: 'Failed to initiate call' });
  }
});

// Route to send SMS to loan officer
router.post('/sms/:loanOfficerId', async (req, res) => {
  try {
    const { loanOfficerId } = req.params;
    const { message, customerPhone, customerName } = req.body;

    const loanOfficer = loanOfficers[loanOfficerId];
    if (!loanOfficer) {
      return res.status(404).json({ error: 'Loan officer not found' });
    }

    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    // Forward message to loan officer with customer info
    const sms = await twilioClient.messages.create({
      body: `New message from ${customerName} (${customerPhone}):\n\n${message}`,
      to: loanOfficer.phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    // Send confirmation to customer
    await twilioClient.messages.create({
      body: `Your message has been sent to ${loanOfficer.name}. They will respond shortly.`,
      to: customerPhone,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({
      success: true,
      messageSid: sms.sid,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Voice handler for connecting calls
router.post('/voice-handler/:loanOfficerId', (req, res) => {
  const { loanOfficerId } = req.params;
  const loanOfficer = loanOfficers[loanOfficerId];

  if (!loanOfficer) {
    res.type('text/xml');
    res.send(`
      <Response>
        <Say>Sorry, the loan officer is not available. Please try again later.</Say>
      </Response>
    `);
    return;
  }

  // TwiML response to connect the call
  res.type('text/xml');
  res.send(`
    <Response>
      <Say>Connecting you with ${loanOfficer.name}. Please hold.</Say>
      <Dial>${loanOfficer.phoneNumber}</Dial>
    </Response>
  `);
});

// Webhook for incoming SMS messages
router.post('/sms-webhook', async (req, res) => {
  const { From, Body, To } = req.body;

  // Find which loan officer this message is for
  const loanOfficer = Object.values(loanOfficers).find(lo =>
    lo.phoneNumber === To || lo.phoneNumber === From
  );

  if (loanOfficer) {
    console.log(`Message for ${loanOfficer.name}: ${Body} from ${From}`);

    // In production, you'd store this message in your database
    // and potentially forward it to your web application
  }

  res.type('text/xml');
  res.send(`
    <Response>
      <Message>Thank you for your message. A loan officer will respond shortly.</Message>
    </Response>
  `);
});

// Get all recordings
router.get('/recordings', async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    const recordings = await twilioClient.recordings.list({
      limit: 20
    });

    const recordingsData = await Promise.all(recordings.map(async (recording) => {
      // Get call details for each recording
      let callDetails = null;
      try {
        const call = await twilioClient.calls(recording.callSid).fetch();
        callDetails = {
          from: call.from,
          to: call.to,
          direction: call.direction,
          startTime: call.startTime
        };
      } catch (e) {
        console.log('Could not fetch call details for', recording.callSid);
      }

      // Get customer data if available
      const customerData = callDataStore[recording.callSid] || {};

      // Check if transcription is available
      const transcription = getTranscription(recording.sid);

      return {
        sid: recording.sid,
        callSid: recording.callSid,
        duration: recording.duration,
        dateCreated: recording.dateCreated,
        status: recording.status,
        mediaUrl: `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`,
        callDetails: callDetails,
        customerName: customerData.customerName && customerData.customerName !== 'Unknown' ? customerData.customerName : '',
        customerEmail: customerData.customerEmail || '',
        customerPhone: customerData.customerPhone || callDetails?.from || '',
        loanOfficer: customerData.loanOfficer || 'Tony Nasim',
        hasTranscription: !!transcription,
        transcription: transcription,
        processedData: transcription?.processedData || null,
        emailSent: transcription?.processedData ? true : false
      };
    }));

    res.json({
      success: true,
      recordings: recordingsData
    });
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// Stream a specific recording
router.get('/recording/:recordingSid/stream', async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const axios = require('axios');

    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    // Get the recording media URL
    const recording = await twilioClient.recordings(recordingSid).fetch();
    const mediaUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

    // Download the recording from Twilio with authentication
    const response = await axios.get(mediaUrl, {
      responseType: 'stream',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Stream the audio to the client
    response.data.pipe(res);
  } catch (error) {
    console.error('Error streaming recording:', error);
    res.status(500).json({ error: 'Failed to stream recording' });
  }
});

// Handle call status updates
router.post('/call-status', (req, res) => {
  const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

  console.log(`📞 Call Status Update - SID: ${CallSid}`);
  console.log(`   Status: ${CallStatus}`);
  console.log(`   Duration: ${CallDuration}s`);

  if (RecordingUrl) {
    console.log(`   🎙️ Recording Available: ${RecordingUrl}`);
  }

  // You can store this in a database or send to frontend via WebSocket
  res.status(200).send('OK');
});

// Handle recording status and auto-transcribe
router.post('/recording-status', async (req, res) => {
  const { RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration, CallSid } = req.body;

  console.log(`🎙️ Recording Status - SID: ${RecordingSid}`);
  console.log(`   Call SID: ${CallSid}`);
  console.log(`   Status: ${RecordingStatus}`);
  console.log(`   Duration: ${RecordingDuration}s`);
  console.log(`   URL: ${RecordingUrl}`);

  // Auto-transcribe when recording is completed
  if (RecordingStatus === 'completed' && RecordingUrl) {
    console.log(`🚀 Starting auto-transcription for ${RecordingSid}`);
    // Start transcription in background (don't wait)
    autoTranscribe(RecordingSid, RecordingUrl).catch(err => {
      console.error('Auto-transcribe failed:', err);
    });
  }

  res.status(200).send('OK');
});

// Get loan officer availability
router.get('/loan-officer/:loanOfficerId/status', (req, res) => {
  const { loanOfficerId } = req.params;
  const loanOfficer = loanOfficers[loanOfficerId];

  if (!loanOfficer) {
    return res.status(404).json({ error: 'Loan officer not found' });
  }

  const now = new Date();
  const currentHour = now.getHours();
  const businessStart = parseInt(loanOfficer.businessHours.start.split(':')[0]);
  const businessEnd = parseInt(loanOfficer.businessHours.end.split(':')[0]);

  const isBusinessHours = currentHour >= businessStart && currentHour < businessEnd;

  res.json({
    id: loanOfficer.id,
    name: loanOfficer.name,
    location: loanOfficer.location,
    available: loanOfficer.available && isBusinessHours,
    businessHours: loanOfficer.businessHours
  });
});

// Get call status endpoint for frontend
router.get('/call/:callSid/status', async (req, res) => {
  const { callSid } = req.params;

  try {
    // Check if we have call data stored
    const callData = callDataStore[callSid];

    if (callData) {
      res.json({
        success: true,
        callSid: callSid,
        status: 'completed',
        customerName: callData.customerName,
        customerPhone: callData.customerPhone,
        customerEmail: callData.customerEmail,
        loanOfficer: callData.loanOfficer
      });
    } else {
      // Try to fetch from Twilio
      if (twilioClient) {
        try {
          const call = await twilioClient.calls(callSid).fetch();
          res.json({
            success: true,
            callSid: callSid,
            status: call.status,
            from: call.from,
            to: call.to,
            duration: call.duration
          });
        } catch (error) {
          res.json({
            success: false,
            error: 'Call not found'
          });
        }
      } else {
        res.json({
          success: false,
          error: 'Call data not available'
        });
      }
    }
  } catch (error) {
    console.error('Error fetching call status:', error);
    res.status(500).json({ error: 'Failed to fetch call status' });
  }
});

module.exports = router;