const nodemailer = require('nodemailer');

// Create Gmail transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER || 'your-email@gmail.com',
      pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
    }
  });
};

/**
 * Generate HTML email template for loan officer
 */
function generateLoanOfficerEmail(processedData) {
  const { extracted_data, action_items, sentiment_analysis, call_info } = processedData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .container { max-width: 800px; margin: 0 auto; background: #f9f9f9; }
        .content { padding: 20px; background: white; }
        .section { margin-bottom: 25px; }
        .section-title { color: #667eea; font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #667eea; padding-bottom: 5px; }
        .field-row { display: flex; margin-bottom: 8px; }
        .field-label { font-weight: bold; width: 150px; color: #555; }
        .field-value { flex: 1; color: #222; }
        .action-item { background: #f0f8ff; padding: 10px; margin: 5px 0; border-left: 4px solid #667eea; }
        .priority-high { border-left-color: #ff4444; }
        .priority-medium { border-left-color: #ffaa00; }
        .priority-low { border-left-color: #44ff44; }
        .summary-box { background: #f5f5ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .sentiment { display: inline-block; padding: 5px 10px; border-radius: 15px; font-size: 12px; }
        .sentiment-positive { background: #d4ffd4; color: #008800; }
        .sentiment-neutral { background: #ffffd4; color: #888800; }
        .sentiment-negative { background: #ffd4d4; color: #880000; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 10px 20px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🏠 LendWise Mortgage - Call Summary</h2>
          <p style="margin: 0;">Call Date: ${new Date(call_info.date).toLocaleString()}</p>
          <p style="margin: 0;">Duration: ${call_info.duration} seconds</p>
          <p style="margin: 0;">Loan Officer: ${call_info.loan_officer}</p>
        </div>

        <div class="content">
          <!-- Summary -->
          <div class="summary-box">
            <strong>📋 Call Summary:</strong><br>
            ${extracted_data.summary || 'Mortgage inquiry call - details extracted below.'}
            <br><br>
            <span class="sentiment sentiment-${sentiment_analysis.sentiment}">
              Sentiment: ${sentiment_analysis.sentiment.toUpperCase()}
            </span>
            <span class="sentiment sentiment-${sentiment_analysis.urgency === 'high' ? 'negative' : sentiment_analysis.urgency === 'medium' ? 'neutral' : 'positive'}">
              Urgency: ${sentiment_analysis.urgency.toUpperCase()}
            </span>
          </div>

          <!-- Borrower Information -->
          <div class="section">
            <div class="section-title">👤 Borrower Information</div>
            <div class="field-row">
              <span class="field-label">Name:</span>
              <span class="field-value">${extracted_data.borrower_information?.full_name || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Phone:</span>
              <span class="field-value">${extracted_data.borrower_information?.phone_number || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Email:</span>
              <span class="field-value">${extracted_data.borrower_information?.email_address || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Address:</span>
              <span class="field-value">${extracted_data.borrower_information?.current_address || 'Not provided'}</span>
            </div>
          </div>

          <!-- Loan Details -->
          <div class="section">
            <div class="section-title">💰 Loan Details</div>
            <div class="field-row">
              <span class="field-label">Purpose:</span>
              <span class="field-value">${extracted_data.loan_details?.loan_purpose || 'Not specified'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Amount:</span>
              <span class="field-value">${extracted_data.loan_details?.requested_loan_amount || 'Not specified'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Property:</span>
              <span class="field-value">${extracted_data.loan_details?.property_address || 'Not specified'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Property Type:</span>
              <span class="field-value">${extracted_data.loan_details?.property_type || 'Not specified'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Occupancy:</span>
              <span class="field-value">${extracted_data.loan_details?.occupancy || 'Not specified'}</span>
            </div>
          </div>

          <!-- Financial Information -->
          <div class="section">
            <div class="section-title">📊 Financial Information</div>
            <div class="field-row">
              <span class="field-label">Credit Score:</span>
              <span class="field-value">${extracted_data.financial_information?.credit_score || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Annual Income:</span>
              <span class="field-value">${extracted_data.financial_information?.annual_income || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Employment:</span>
              <span class="field-value">${extracted_data.financial_information?.employment_status || 'Not provided'}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Down Payment:</span>
              <span class="field-value">${extracted_data.financial_information?.down_payment_amount || 'Not provided'}</span>
            </div>
          </div>

          <!-- Action Items -->
          <div class="section">
            <div class="section-title">✅ Action Items</div>
            ${action_items.map(item => `
              <div class="action-item priority-${item.priority}">
                <strong>${item.task}</strong><br>
                Priority: ${item.priority.toUpperCase()}<br>
                ${item.due_date ? `Due: ${new Date(item.due_date).toLocaleDateString()}` : 'No specific deadline'}
              </div>
            `).join('')}
          </div>

          <!-- Concerns & Opportunities -->
          ${sentiment_analysis.concerns && sentiment_analysis.concerns.length > 0 ? `
            <div class="section">
              <div class="section-title">⚠️ Concerns</div>
              <ul>
                ${sentiment_analysis.concerns.map(concern => `<li>${concern}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${sentiment_analysis.opportunities && sentiment_analysis.opportunities.length > 0 ? `
            <div class="section">
              <div class="section-title">💡 Opportunities</div>
              <ul>
                ${sentiment_analysis.opportunities.map(opp => `<li>${opp}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- CTA Buttons -->
          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:3004" class="button">View Full Transcript</a>
            <a href="mailto:${extracted_data.borrower_information?.email_address || ''}" class="button">Email Borrower</a>
          </div>
        </div>

        <div class="footer">
          <p>This email was automatically generated by LendWise Mortgage AI System</p>
          <p>Confidence Score: ${extracted_data.confidence_score || 0}%</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate text version for email
 */
function generateTextEmail(processedData) {
  const { extracted_data, action_items, call_info } = processedData;

  return `
LENDWISE MORTGAGE - CALL SUMMARY
================================
Date: ${new Date(call_info.date).toLocaleString()}
Duration: ${call_info.duration} seconds
Loan Officer: ${call_info.loan_officer}

SUMMARY
-------
${extracted_data.summary || 'Mortgage inquiry call - details extracted below.'}

BORROWER INFORMATION
-------------------
Name: ${extracted_data.borrower_information?.full_name || 'Not provided'}
Phone: ${extracted_data.borrower_information?.phone_number || 'Not provided'}
Email: ${extracted_data.borrower_information?.email_address || 'Not provided'}
Address: ${extracted_data.borrower_information?.current_address || 'Not provided'}

LOAN DETAILS
-----------
Purpose: ${extracted_data.loan_details?.loan_purpose || 'Not specified'}
Amount: ${extracted_data.loan_details?.requested_loan_amount || 'Not specified'}
Property: ${extracted_data.loan_details?.property_address || 'Not specified'}
Type: ${extracted_data.loan_details?.property_type || 'Not specified'}

ACTION ITEMS
-----------
${action_items.map(item =>
  `• ${item.task} (Priority: ${item.priority})${item.due_date ? ` - Due: ${new Date(item.due_date).toLocaleDateString()}` : ''}`
).join('\n')}

---
This email was automatically generated by LendWise Mortgage AI System
Confidence Score: ${extracted_data.confidence_score || 0}%
  `;
}

/**
 * Send email notification to loan officer
 */
async function sendLoanOfficerNotification(processedData, loanOfficerEmail, transcriptText) {
  try {
    const transporter = createTransporter();

    // Prepare attachments
    const attachments = [];

    // Add transcript as attachment
    if (transcriptText) {
      attachments.push({
        filename: `transcript_${processedData.call_info.sid || Date.now()}.txt`,
        content: transcriptText
      });
    }

    // Add JSON data as attachment
    attachments.push({
      filename: `call_data_${processedData.call_info.sid || Date.now()}.json`,
      content: JSON.stringify(processedData, null, 2)
    });

    // Email options
    const mailOptions = {
      from: `"LendWise AI" <${process.env.GMAIL_USER}>`,
      to: loanOfficerEmail,
      subject: `🏠 New Lead: ${processedData.extracted_data.borrower_information?.full_name || 'Unknown'} - ${processedData.extracted_data.loan_details?.loan_purpose || 'Mortgage Inquiry'}`,
      text: generateTextEmail(processedData),
      html: generateLoanOfficerEmail(processedData),
      attachments: attachments
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('✉️ Email sent to loan officer:', info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send follow-up email to customer
 */
async function sendCustomerFollowUp(borrowerEmail, borrowerName, loanOfficerName) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${loanOfficerName} - LendWise Mortgage" <${process.env.GMAIL_USER}>`,
      to: borrowerEmail,
      subject: 'Thank you for contacting LendWise Mortgage',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #667eea;">Thank you for your interest in LendWise Mortgage!</h2>

          <p>Dear ${borrowerName},</p>

          <p>Thank you for taking the time to speak with us today about your mortgage needs.
          I've reviewed our conversation and will be preparing a personalized loan proposal for you.</p>

          <h3>Next Steps:</h3>
          <ol>
            <li>I'll analyze your financial situation and find the best loan options</li>
            <li>You'll receive a detailed rate quote within 24 hours</li>
            <li>We'll schedule a follow-up call to discuss your options</li>
          </ol>

          <p>In the meantime, please gather the following documents:</p>
          <ul>
            <li>Last 2 years of tax returns</li>
            <li>Last 2 months of bank statements</li>
            <li>Most recent pay stubs (last 30 days)</li>
            <li>Photo ID and Social Security card</li>
          </ul>

          <p>If you have any questions, please don't hesitate to reach out.</p>

          <p>Best regards,<br>
          ${loanOfficerName}<br>
          LendWise Mortgage<br>
          📞 (310) 954-7772<br>
          ✉️ ${loanOfficerName.toLowerCase().replace(' ', '.')}@lendwisemortgage.com</p>

          <hr style="border: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #666;">
            This email and any attachments are confidential and intended solely for the addressee.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✉️ Follow-up email sent to customer:', info.messageId);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Customer email error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendLoanOfficerNotification,
  sendCustomerFollowUp,
  generateLoanOfficerEmail,
  generateTextEmail
};