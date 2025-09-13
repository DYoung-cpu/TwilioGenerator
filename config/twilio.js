const twilio = require('twilio');

// Twilio configuration
const twilioConfig = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER || '+18189182433',
  voiceWebhook: 'https://demo.twilio.com/welcome/voice/',
  smsWebhook: 'https://demo.twilio.com/welcome/sms/reply'
};

// Initialize Twilio client
const twilioClient = twilioConfig.accountSid && twilioConfig.authToken
  ? twilio(twilioConfig.accountSid, twilioConfig.authToken)
  : null;

// Loan officers database (in production, this would be from your database)
const loanOfficers = {
  'tony-nasim': {
    id: 'tony-nasim',
    name: 'Tony Nasim',
    phoneNumber: '+13109547772',  // David's test number
    email: 'tony.nasim@lendwisemortgage.com',
    location: 'Canoga Park, CA',
    available: true,
    businessHours: {
      start: '09:00',
      end: '18:00',
      timezone: 'America/Los_Angeles'
    }
  }
};

module.exports = {
  twilioConfig,
  twilioClient,
  loanOfficers
};