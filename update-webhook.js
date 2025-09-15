require('dotenv').config();
const { twilioClient } = require('./config/twilio');

async function updateWebhook() {
  if (!twilioClient) {
    console.error('❌ Twilio not configured');
    return;
  }

  try {
    // Update your phone number's voice webhook
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    // Find the phone number resource
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber
    });

    if (phoneNumbers.length === 0) {
      console.error('❌ Phone number not found:', phoneNumber);
      return;
    }

    const phoneNumberSid = phoneNumbers[0].sid;

    // Update the webhook URL for recording status callbacks
    const updatedNumber = await twilioClient
      .incomingPhoneNumbers(phoneNumberSid)
      .update({
        voiceUrl: 'https://twilio-generator.vercel.app/api/twilio/voice',
        voiceMethod: 'POST',
        statusCallback: 'https://twilio-generator.vercel.app/api/twilio/recording-status',
        statusCallbackMethod: 'POST'
      });

    console.log('✅ Webhook updated successfully!');
    console.log('   Voice URL:', updatedNumber.voiceUrl);
    console.log('   Status Callback:', updatedNumber.statusCallback);

  } catch (error) {
    console.error('❌ Error updating webhook:', error);
  }
}

updateWebhook();