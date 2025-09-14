const axios = require('axios');
const transcriptionService = require('../lib/transcription-service');
const { processCallTranscript } = require('./ai-processor');
const { sendLoanOfficerNotification, sendCustomerFollowUp } = require('./gmail-notifier');

// For backward compatibility, keep in-memory store
let transcriptionStore = {};

// Load existing transcriptions on startup
(async () => {
  try {
    transcriptionStore = await transcriptionService.getTranscriptions();
    console.log(`📚 Loaded ${Object.keys(transcriptionStore).length} existing transcriptions`);
  } catch (error) {
    console.error('Error loading transcriptions:', error);
    transcriptionStore = {};
  }
})();

// Save transcriptions using the service
async function saveTranscriptions() {
  // This is now handled by transcriptionService
  // Keeping function for backward compatibility
}

// Auto-transcribe when recording is ready
async function autoTranscribe(recordingSid, recordingUrl) {
  try {
    console.log(`🎙️ Auto-transcribing recording ${recordingSid}`);

    const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

    // Download audio from Twilio
    const audioResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Upload to AssemblyAI
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioResponse.data,
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream',
          'transfer-encoding': 'chunked'
        }
      }
    );

    // Start transcription
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: uploadResponse.data.upload_url,
        speaker_labels: true,
        auto_highlights: true,
        entity_detection: true,
        sentiment_analysis: true,
        auto_chapters: true,
        language_detection: true
      },
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptResponse.data.id;

    // Poll for completion
    let transcript = null;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: {
            'authorization': ASSEMBLYAI_API_KEY
          }
        }
      );

      if (statusResponse.data.status === 'completed') {
        transcript = statusResponse.data;
        break;
      } else if (statusResponse.data.status === 'error') {
        throw new Error('Transcription failed');
      }

      attempts++;
    }

    if (transcript) {
      // Store transcription with proper structure
      const transcriptionData = {
        text: transcript.text,
        utterances: transcript.utterances,
        entities: transcript.entities,
        sentiment: transcript.sentiment_analysis_results,
        chapters: transcript.chapters,
        completedAt: new Date()
      };

      transcriptionStore[recordingSid] = transcriptionData;

      // Save to Supabase with proper field mapping
      await transcriptionService.saveTranscription({
        callSid: recordingSid,  // Using recordingSid as callSid since we don't have actual callSid
        recordingSid: recordingSid,
        transcript: transcript.text,  // Save the text as transcript
        transcriptStatus: 'completed',
        status: 'completed',
        duration: transcript.audio_duration
      });

      console.log(`✅ Transcription complete for ${recordingSid}`);

      // Process with AI for field extraction
      try {
        const callData = {
          sid: recordingSid,
          date: new Date(),
          duration: transcript.audio_duration,
          loanOfficer: 'Tony Nasim'
        };

        const processedData = await processCallTranscript(transcript, callData);

        if (processedData) {
          // Store processed data
          transcriptionStore[recordingSid].processedData = processedData;

          // Update Supabase with processed data
          await transcriptionService.saveTranscription({
            callSid: recordingSid,
            recordingSid: recordingSid,
            transcript: transcript.text,
            transcriptStatus: 'completed',
            status: 'completed',
            duration: transcript.audio_duration,
            customerName: processedData.extracted_data?.borrower_information?.full_name || null,
            customerEmail: processedData.extracted_data?.borrower_information?.email_address || null,
            customerPhone: processedData.extracted_data?.borrower_information?.phone_number || null
          });

          // Send email to loan officer
          const loanOfficerEmail = process.env.LOAN_OFFICER_EMAIL || 'tony@lendwisemortgage.com';
          await sendLoanOfficerNotification(processedData, loanOfficerEmail, transcript.text);

          // Send follow-up to customer if email is available
          if (processedData.extracted_data?.borrower_information?.email_address) {
            await sendCustomerFollowUp(
              processedData.extracted_data.borrower_information.email_address,
              processedData.extracted_data.borrower_information.full_name || 'Valued Customer',
              'Tony Nasim'
            );
          }

          console.log(`📧 Notifications sent for ${recordingSid}`);
        }
      } catch (aiError) {
        console.error('AI processing error:', aiError);
      }

      // Broadcast to connected clients
      if (global.io) {
        global.io.emit('transcription-ready', {
          recordingSid,
          transcription: transcriptionStore[recordingSid]
        });
      }
    }

    return transcript;
  } catch (error) {
    console.error('Auto-transcribe error:', error);
    return null;
  }
}

// Get transcription for a recording
async function getTranscription(recordingSid) {
  return await transcriptionService.getTranscription(recordingSid) || transcriptionStore[recordingSid];
}

// Check if transcription exists
async function hasTranscription(recordingSid) {
  const trans = await transcriptionService.getTranscription(recordingSid);
  return !!trans || !!transcriptionStore[recordingSid];
}

// Store transcription manually (for manual transcription route)
async function storeTranscription(recordingSid, transcriptionData) {
  transcriptionStore[recordingSid] = transcriptionData;
  await transcriptionService.saveTranscription({
    callSid: recordingSid,
    recordingSid: recordingSid,
    ...transcriptionData
  });
  await saveTranscriptions();
  console.log(`📝 Stored transcription for ${recordingSid}`);
}

module.exports = {
  autoTranscribe,
  getTranscription,
  hasTranscription,
  storeTranscription
};