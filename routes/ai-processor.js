const OpenAI = require('openai');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

// Mortgage-specific extraction prompt
const EXTRACTION_PROMPT = `You are a mortgage loan processor analyzing a call transcript. Extract the following information:

1. BORROWER INFORMATION:
   - Full name
   - Phone number
   - Email address
   - Current address

2. LOAN DETAILS:
   - Loan purpose (purchase/refinance/cash-out/HELOC)
   - Requested loan amount
   - Property address
   - Property type (single family/condo/multi-family)
   - Occupancy (primary/investment/second home)

3. FINANCIAL INFORMATION:
   - Credit score or range
   - Annual income
   - Employment status
   - Down payment amount
   - Current mortgage rate (if refinancing)
   - Current mortgage payment

4. TIMELINE:
   - Urgency level (high/medium/low)
   - Target closing date
   - Pre-approval needed by

5. ACTION ITEMS:
   - List specific follow-up tasks
   - Documents needed
   - Next steps

6. SUMMARY:
   - Brief overview of the call (2-3 sentences)
   - Key concerns or questions from borrower

Return the data as JSON. Use null for any fields not mentioned in the transcript.`;

/**
 * Extract structured data from call transcript using AI
 */
async function extractMortgageData(transcript) {
  try {
    // Prepare the transcript text
    let transcriptText = '';
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (transcript.utterances) {
      // AssemblyAI format
      transcriptText = transcript.utterances
        .map(u => `${u.speaker}: ${u.text}`)
        .join('\n');
    } else if (transcript.text) {
      transcriptText = transcript.text;
    }

    // Call OpenAI for extraction
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: EXTRACTION_PROMPT
        },
        {
          role: "user",
          content: `Analyze this mortgage call transcript and extract the relevant information:\n\n${transcriptText}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    const extractedData = JSON.parse(response.choices[0].message.content);

    // Add metadata
    extractedData.extraction_timestamp = new Date();
    extractedData.confidence_score = calculateConfidenceScore(extractedData);

    return extractedData;
  } catch (error) {
    console.error('AI extraction error:', error);
    return null;
  }
}

/**
 * Generate action items from extracted data
 */
function generateActionItems(extractedData) {
  const actionItems = [];

  // Check what's missing and create tasks
  if (!extractedData.financial_information?.credit_score) {
    actionItems.push({
      priority: 'high',
      task: 'Obtain credit authorization and pull credit report',
      due_date: getBusinessDaysFromNow(1)
    });
  }

  if (extractedData.loan_details?.loan_purpose === 'purchase' && !extractedData.loan_details?.property_address) {
    actionItems.push({
      priority: 'medium',
      task: 'Get property address once borrower finds a home',
      due_date: null
    });
  }

  if (extractedData.loan_details?.loan_purpose === 'refinance') {
    actionItems.push({
      priority: 'high',
      task: 'Order property appraisal',
      due_date: getBusinessDaysFromNow(3)
    });
    actionItems.push({
      priority: 'high',
      task: 'Request current mortgage statement',
      due_date: getBusinessDaysFromNow(2)
    });
  }

  // Standard document collection
  actionItems.push({
    priority: 'high',
    task: 'Collect last 2 years tax returns',
    due_date: getBusinessDaysFromNow(3)
  });

  actionItems.push({
    priority: 'high',
    task: 'Collect last 2 months bank statements',
    due_date: getBusinessDaysFromNow(3)
  });

  actionItems.push({
    priority: 'high',
    task: 'Collect last 30 days pay stubs',
    due_date: getBusinessDaysFromNow(3)
  });

  // Add custom action items from AI extraction
  if (extractedData.action_items) {
    extractedData.action_items.forEach(item => {
      if (typeof item === 'string') {
        actionItems.push({
          priority: 'medium',
          task: item,
          due_date: getBusinessDaysFromNow(5)
        });
      } else {
        actionItems.push(item);
      }
    });
  }

  return actionItems;
}

/**
 * Calculate confidence score based on completeness of extracted data
 */
function calculateConfidenceScore(data) {
  let filledFields = 0;
  let totalFields = 0;

  function countFields(obj) {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        totalFields++;
        if (obj[key] !== null && obj[key] !== undefined && obj[key] !== '') {
          filledFields++;
        }
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          countFields(obj[key]);
        }
      }
    }
  }

  countFields(data);
  return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
}

/**
 * Get business days from now
 */
function getBusinessDaysFromNow(days) {
  const date = new Date();
  let businessDays = 0;

  while (businessDays < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      businessDays++;
    }
  }

  return date;
}

/**
 * Analyze sentiment and urgency
 */
async function analyzeSentiment(transcript) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "Analyze the sentiment and urgency of this mortgage inquiry. Return JSON with: sentiment (positive/neutral/negative), urgency (high/medium/low), concerns (array of concerns), and opportunities (array of opportunities)."
        },
        {
          role: "user",
          content: transcript
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return {
      sentiment: 'neutral',
      urgency: 'medium',
      concerns: [],
      opportunities: []
    };
  }
}

/**
 * Main processing function
 */
async function processCallTranscript(transcript, callData) {
  console.log('🤖 Processing transcript with AI...');

  // Extract structured data
  const extractedData = await extractMortgageData(transcript);

  if (!extractedData) {
    console.error('Failed to extract data');
    return null;
  }

  // Generate action items
  const actionItems = generateActionItems(extractedData);

  // Analyze sentiment
  const sentiment = await analyzeSentiment(
    typeof transcript === 'string' ? transcript : transcript.text
  );

  // Combine all data
  const processedData = {
    call_info: {
      sid: callData?.sid,
      date: callData?.date || new Date(),
      duration: callData?.duration,
      loan_officer: callData?.loanOfficer || 'Tony Nasim'
    },
    extracted_data: extractedData,
    action_items: actionItems,
    sentiment_analysis: sentiment,
    processed_at: new Date()
  };

  console.log('✅ AI processing complete');
  return processedData;
}

module.exports = {
  extractMortgageData,
  generateActionItems,
  analyzeSentiment,
  processCallTranscript
};