const express = require('express');
const router = express.Router();
const axios = require('axios');
const { twilioClient } = require('../config/twilio');
const { storeTranscription } = require('./auto-transcribe');

// AssemblyAI API configuration
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Map transcript IDs to recording SIDs
const transcriptToRecordingMap = {};

// Transcribe a Twilio recording
router.post('/transcribe/:recordingSid', async (req, res) => {
  try {
    const { recordingSid } = req.params;

    if (!twilioClient) {
      return res.status(500).json({ error: 'Twilio not configured' });
    }

    // Get recording details
    const recording = await twilioClient.recordings(recordingSid).fetch();
    const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

    // First, download the audio from Twilio
    const audioResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Step 1: Upload audio data to AssemblyAI
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

    const audioUrl = uploadResponse.data.upload_url;

    // Step 2: Request transcription
    const transcriptResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      {
        audio_url: audioUrl,
        speaker_labels: true, // Enable speaker diarization
        auto_highlights: true,
        entity_detection: true,
        sentiment_analysis: true,
        auto_chapters: true
      },
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptResponse.data.id;

    // Store mapping
    transcriptToRecordingMap[transcriptId] = recordingSid;

    // Return the transcript ID for polling
    res.json({
      success: true,
      transcriptId: transcriptId,
      message: 'Transcription started'
    });

  } catch (error) {
    console.error('Error starting transcription:', error);
    res.status(500).json({ error: 'Failed to start transcription' });
  }
});

// Check transcription status
router.get('/transcribe/status/:transcriptId', async (req, res) => {
  try {
    const { transcriptId } = req.params;
    const recordingSid = transcriptToRecordingMap[transcriptId]; // Get from mapping

    const response = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY
        }
      }
    );

    const transcript = response.data;

    if (transcript.status === 'completed') {
      // Format the response with speakers and timestamps
      const formattedTranscript = formatTranscript(transcript);
      const insights = extractInsights(transcript);

      // Store the transcription if we have a recordingSid
      if (recordingSid) {
        storeTranscription(recordingSid, {
          text: transcript.text,
          utterances: transcript.utterances,
          entities: transcript.entities,
          sentiment: transcript.sentiment_analysis_results,
          chapters: transcript.chapters,
          completedAt: new Date(),
          insights: insights
        });
      }

      res.json({
        success: true,
        status: 'completed',
        transcript: formattedTranscript,
        insights: insights
      });
    } else if (transcript.status === 'error') {
      res.json({
        success: false,
        status: 'error',
        error: transcript.error
      });
    } else {
      res.json({
        success: true,
        status: transcript.status,
        message: 'Transcription in progress'
      });
    }

  } catch (error) {
    console.error('Error checking transcription status:', error);
    res.status(500).json({ error: 'Failed to check transcription status' });
  }
});

// Alternative: Use OpenAI Whisper API (if you have OpenAI API access)
router.post('/transcribe-whisper/:recordingSid', async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    // Get recording URL
    const recording = await twilioClient.recordings(recordingSid).fetch();
    const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;

    // Download the audio file
    const audioResponse = await axios.get(recordingUrl, {
      responseType: 'arraybuffer',
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN
      }
    });

    // Create form data for OpenAI
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', Buffer.from(audioResponse.data), {
      filename: 'recording.mp3',
      contentType: 'audio/mpeg'
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');

    // Send to OpenAI Whisper
    const whisperResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    res.json({
      success: true,
      transcript: whisperResponse.data
    });

  } catch (error) {
    console.error('Error with Whisper transcription:', error);
    res.status(500).json({ error: 'Failed to transcribe with Whisper' });
  }
});

// Helper function to format transcript with speakers
function formatTranscript(transcript) {
  if (!transcript.utterances) {
    return [{
      speaker: 'Speaker',
      text: transcript.text,
      start: 0,
      end: transcript.audio_duration
    }];
  }

  return transcript.utterances.map(utterance => ({
    speaker: `Speaker ${utterance.speaker}`,
    text: utterance.text,
    start: utterance.start,
    end: utterance.end,
    confidence: utterance.confidence
  }));
}

// Extract AI insights from transcript
function extractInsights(transcript) {
  const insights = [];

  // Sentiment analysis
  if (transcript.sentiment_analysis_results) {
    const sentiments = transcript.sentiment_analysis_results;
    const avgSentiment = sentiments.reduce((acc, s) => {
      if (s.sentiment === 'POSITIVE') return acc + 1;
      if (s.sentiment === 'NEGATIVE') return acc - 1;
      return acc;
    }, 0) / sentiments.length;

    if (avgSentiment > 0.3) {
      insights.push('😊 Positive conversation tone');
    } else if (avgSentiment < -0.3) {
      insights.push('😟 Negative conversation tone - may need follow-up');
    } else {
      insights.push('😐 Neutral conversation tone');
    }
  }

  // Key topics from entities
  if (transcript.entities && transcript.entities.length > 0) {
    const topics = transcript.entities
      .filter(e => e.entity_type === 'topic')
      .map(e => e.text)
      .slice(0, 3);

    if (topics.length > 0) {
      insights.push(`📌 Key topics: ${topics.join(', ')}`);
    }
  }

  // Auto chapters/summary
  if (transcript.chapters && transcript.chapters.length > 0) {
    insights.push(`📚 ${transcript.chapters.length} main discussion points identified`);
  }

  // Call to action detection
  const text = transcript.text.toLowerCase();
  if (text.includes('schedule') || text.includes('appointment') || text.includes('meeting')) {
    insights.push('📅 Follow-up appointment discussed');
  }
  if (text.includes('email') || text.includes('send')) {
    insights.push('✉️ Information to be sent via email');
  }
  if (text.includes('rate') || text.includes('interest') || text.includes('payment')) {
    insights.push('💰 Financial details discussed');
  }
  if (text.includes('document') || text.includes('paperwork')) {
    insights.push('📄 Documentation requirements mentioned');
  }

  return insights;
}

// Get transcription with AI data for a recording
router.get('/:recordingSid/full', (req, res) => {
  try {
    const { recordingSid } = req.params;
    const { hasTranscription, getTranscription } = require('./auto-transcribe');

    if (hasTranscription(recordingSid)) {
      const transcriptionData = getTranscription(recordingSid);
      res.json({
        success: true,
        hasTranscription: true,
        transcription: transcriptionData
      });
    } else {
      res.json({
        success: true,
        hasTranscription: false,
        transcription: null
      });
    }
  } catch (error) {
    console.error('Error getting full transcription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transcription data'
    });
  }
});

module.exports = router;