# Twilio Generator - Complete Call Management System

A comprehensive Twilio-based call management system with AI-powered transcription for LendWise Mortgage.

## Features

- 📞 **Click-to-Call**: Instant calling from web interface
- 🎙️ **Call Recording**: Automatic recording of all calls
- 📝 **AI Transcription**: AssemblyAI-powered transcription with speaker identification
- 📊 **Real-time Monitoring**: Live call status tracking
- 📈 **Call Analytics**: Insights and action items extracted from conversations
- 🔐 **Secure**: Credentials stored in environment variables

## Quick Start

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env` and add your credentials:
```bash
cp .env.example .env
```

Required credentials:
- **Twilio Account SID**: From https://console.twilio.com
- **Twilio Auth Token**: From https://console.twilio.com
- **Twilio Phone Number**: Your Twilio phone number
- **AssemblyAI API Key**: From https://www.assemblyai.com

### Step 3: Start the Server
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### Step 4: Open Dashboard
Navigate to: http://localhost:3003

## Project Structure

```
TwilioGenerator/
├── server.js           # Main Express server
├── routes/
│   ├── twilio.js      # Twilio call & SMS routes
│   └── transcription.js # AssemblyAI transcription
├── config/
│   └── twilio.js      # Twilio configuration
├── public/
│   └── index.html     # Main dashboard UI
├── .env               # Environment variables (create from .env.example)
└── package.json       # Dependencies
```

## API Endpoints

### Twilio Routes
- `POST /api/twilio/call/:loanOfficerId` - Initiate call
- `POST /api/twilio/sms/:loanOfficerId` - Send SMS
- `GET /api/twilio/recordings` - List all recordings
- `GET /api/twilio/recording/:sid/stream` - Stream recording

### Transcription Routes
- `POST /api/transcription/transcribe/:recordingSid` - Start transcription
- `GET /api/transcription/transcribe/status/:transcriptId` - Check status

## Current Loan Officers

- **Tony Nasim**: ID `tony-nasim`
  - Phone: +13109547772 (configured for testing)
  - Location: Los Angeles
  - Hours: 9 AM - 6 PM PST

## Testing

1. Open the dashboard at http://localhost:3003
2. Enter customer name and phone number
3. Click "Start Call" to initiate
4. After call completes, click "Transcribe Recording"
5. View real-time transcription and AI insights

## Troubleshooting

### Recordings not showing?
- Check browser console for errors
- Verify Twilio credentials in `.env`
- Ensure server is running on port 3003

### Transcription not working?
- Verify AssemblyAI API key in `.env`
- Check network connectivity
- Look for errors in server console

### Authentication popup for recordings?
- Server automatically handles Twilio auth
- If persists, restart the server

## Future Enhancements

- [ ] Real-time transcription during calls
- [ ] Google Calendar integration
- [ ] Automated follow-up emails
- [ ] CRM integration
- [ ] Multiple loan officer support

## Support

For issues or questions, contact David Young.

## License

MIT - LendWise Mortgage 2025