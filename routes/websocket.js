const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');

// Initialize Deepgram (we'll use a free API key for now)
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || 'YOUR_DEEPGRAM_KEY');

// Store active connections
const activeConnections = new Map();

function setupWebSocketServer(server) {
  const wss = new WebSocket.Server({ server, path: '/media-stream' });

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection for media stream');

    let callSid = null;
    let streamSid = null;
    let deepgramConnection = null;
    let transcriptBuffer = [];

    ws.on('message', async (message) => {
      const msg = JSON.parse(message);

      switch (msg.event) {
        case 'start':
          callSid = msg.start.callSid;
          streamSid = msg.start.streamSid;
          console.log(`Stream started for call ${callSid}`);

          // Initialize Deepgram connection for real-time transcription
          try {
            deepgramConnection = deepgram.listen.live({
              model: 'nova-2',
              language: 'en-US',
              punctuate: true,
              smart_format: true,
              diarize: true,
              interim_results: true,
              utterance_end_ms: 1000,
            });

            deepgramConnection.on('open', () => {
              console.log('Deepgram connection opened');
            });

            deepgramConnection.on('transcript', (data) => {
              const transcript = data.channel.alternatives[0].transcript;

              if (transcript && data.is_final) {
                // Send transcript to connected clients
                const transcriptData = {
                  type: 'transcript',
                  callSid: callSid,
                  speaker: data.channel.alternatives[0].words?.[0]?.speaker || 'Unknown',
                  text: transcript,
                  timestamp: new Date().toISOString()
                };

                // Store in buffer
                transcriptBuffer.push(transcriptData);

                // Broadcast to all connected clients
                broadcastTranscript(callSid, transcriptData);
              }
            });

            deepgramConnection.on('error', (error) => {
              console.error('Deepgram error:', error);
            });

          } catch (error) {
            console.error('Error setting up Deepgram:', error);
          }
          break;

        case 'media':
          // Forward audio to Deepgram
          if (deepgramConnection && deepgramConnection.getReadyState() === WebSocket.OPEN) {
            const audioBuffer = Buffer.from(msg.media.payload, 'base64');
            deepgramConnection.send(audioBuffer);
          }
          break;

        case 'stop':
          console.log(`Stream stopped for call ${callSid}`);
          if (deepgramConnection) {
            deepgramConnection.finish();
          }

          // Store the complete transcript
          if (callSid && transcriptBuffer.length > 0) {
            activeConnections.set(callSid, {
              transcript: transcriptBuffer,
              endTime: new Date()
            });
          }
          break;
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      if (deepgramConnection) {
        deepgramConnection.finish();
      }
    });
  });

  return wss;
}

// Function to broadcast transcripts to connected UI clients
function broadcastTranscript(callSid, transcriptData) {
  // This will be connected to Socket.IO for the frontend
  if (global.io) {
    global.io.emit('live-transcript', transcriptData);
  }
}

// Get transcript for a call
function getCallTranscript(callSid) {
  return activeConnections.get(callSid);
}

module.exports = {
  setupWebSocketServer,
  getCallTranscript
};