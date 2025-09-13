const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Import routes
const twilioRoutes = require('./routes/twilio');
const transcriptionRoutes = require('./routes/transcription');

// API Routes
app.use('/api/twilio', twilioRoutes);
app.use('/api/transcription', transcriptionRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      twilio: !!process.env.TWILIO_ACCOUNT_SID,
      assemblyai: !!process.env.ASSEMBLYAI_API_KEY
    }
  });
});

// Serve the main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Twilio Generator Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔐 Health check: http://localhost:${PORT}/health`);
});