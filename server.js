const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Make io globally available
global.io = io;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import routes
const twilioRoutes = require('./routes/twilio');
const transcriptionRoutes = require('./routes/transcription');
const { setupWebSocketServer } = require('./routes/websocket');

// API Routes
app.use('/api/twilio', twilioRoutes);
app.use('/api/transcription', transcriptionRoutes);
app.use('/api/training', require('./routes/training'));

// Setup WebSocket for Twilio Media Streams
setupWebSocketServer(server);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected for live transcription');

  socket.on('join-call', (callSid) => {
    socket.join(callSid);
    console.log(`Client joined call room: ${callSid}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
      assemblyai: !!process.env.ASSEMBLYAI_API_KEY,
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      websocket: 'active'
    }
  });
});

// Serve the main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Twilio Generator Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔐 Health check: http://localhost:${PORT}/health`);
  console.log(`🎙️ Live transcription: WebSocket ready`);
});