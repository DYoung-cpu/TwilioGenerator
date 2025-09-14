const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Directory for storing training data
const TRAINING_DATA_DIR = path.join(__dirname, '..', 'training-data');

// Ensure training data directory exists
async function ensureTrainingDirectory() {
  try {
    await fs.access(TRAINING_DATA_DIR);
  } catch {
    await fs.mkdir(TRAINING_DATA_DIR, { recursive: true });
  }
}

// Save training data for a recording
router.post('/save', async (req, res) => {
  try {
    const { recordingSid, transcript, markedFields, trainedBy, trainedAt } = req.body;

    if (!recordingSid || !markedFields) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await ensureTrainingDirectory();

    // Save training data
    const trainingFile = path.join(TRAINING_DATA_DIR, `${recordingSid}.json`);
    const trainingData = {
      recordingSid,
      transcript,
      markedFields,
      trainedBy,
      trainedAt,
      version: 1
    };

    await fs.writeFile(trainingFile, JSON.stringify(trainingData, null, 2));

    // Also append to master training dataset
    const masterFile = path.join(TRAINING_DATA_DIR, 'master-training-set.jsonl');
    const masterEntry = {
      recordingSid,
      markedFields,
      trainedAt,
      trainedBy
    };
    await fs.appendFile(masterFile, JSON.stringify(masterEntry) + '\n');

    console.log(`✅ Training data saved for recording ${recordingSid}`);

    res.json({
      success: true,
      message: 'Training data saved successfully'
    });
  } catch (error) {
    console.error('Error saving training data:', error);
    res.status(500).json({ error: 'Failed to save training data' });
  }
});

// Get training data for a specific recording
router.get('/:recordingSid', async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const trainingFile = path.join(TRAINING_DATA_DIR, `${recordingSid}.json`);

    try {
      const data = await fs.readFile(trainingFile, 'utf8');
      res.json(JSON.parse(data));
    } catch (error) {
      // No training data exists yet
      res.status(404).json({ error: 'No training data found' });
    }
  } catch (error) {
    console.error('Error loading training data:', error);
    res.status(500).json({ error: 'Failed to load training data' });
  }
});

// Export all training data
router.get('/export', async (req, res) => {
  try {
    await ensureTrainingDirectory();

    const files = await fs.readdir(TRAINING_DATA_DIR);
    const trainingData = [];

    for (const file of files) {
      if (file.endsWith('.json') && file !== 'master-training-set.json') {
        const filePath = path.join(TRAINING_DATA_DIR, file);
        const data = await fs.readFile(filePath, 'utf8');
        trainingData.push(JSON.parse(data));
      }
    }

    res.json({
      exportDate: new Date(),
      totalRecordings: trainingData.length,
      data: trainingData
    });
  } catch (error) {
    console.error('Error exporting training data:', error);
    res.status(500).json({ error: 'Failed to export training data' });
  }
});

// Get training statistics
router.get('/stats', async (req, res) => {
  try {
    await ensureTrainingDirectory();

    const files = await fs.readdir(TRAINING_DATA_DIR);
    let totalRecordings = 0;
    let totalFields = 0;
    const fieldCounts = {};

    for (const file of files) {
      if (file.endsWith('.json') && file !== 'master-training-set.json') {
        totalRecordings++;
        const filePath = path.join(TRAINING_DATA_DIR, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

        if (data.markedFields) {
          for (const [fieldType, marks] of Object.entries(data.markedFields)) {
            if (!fieldCounts[fieldType]) {
              fieldCounts[fieldType] = 0;
            }
            fieldCounts[fieldType] += marks.length;
            totalFields += marks.length;
          }
        }
      }
    }

    // Calculate a mock accuracy score based on training data
    // In production, this would be based on actual AI performance metrics
    const accuracy = totalRecordings > 0 ? Math.min(95, 60 + (totalRecordings * 2)) : 0;

    res.json({
      totalRecordings,
      totalFields,
      fieldCounts,
      accuracy,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error getting training stats:', error);
    res.status(500).json({ error: 'Failed to get training stats' });
  }
});

// Update AI extraction prompt based on training data
router.post('/update-prompt', async (req, res) => {
  try {
    await ensureTrainingDirectory();

    // Collect all training examples
    const files = await fs.readdir(TRAINING_DATA_DIR);
    const examples = [];

    for (const file of files) {
      if (file.endsWith('.json') && file !== 'master-training-set.json') {
        const filePath = path.join(TRAINING_DATA_DIR, file);
        const data = JSON.parse(await fs.readFile(filePath, 'utf8'));

        if (data.markedFields && data.transcript) {
          examples.push({
            text: data.transcript.text || data.transcript.utterances?.map(u => u.text).join(' '),
            fields: data.markedFields
          });
        }
      }
    }

    // Generate enhanced prompt with examples
    const enhancedPrompt = generateEnhancedPrompt(examples);

    // Save the enhanced prompt
    const promptFile = path.join(TRAINING_DATA_DIR, 'enhanced-prompt.txt');
    await fs.writeFile(promptFile, enhancedPrompt);

    console.log(`🎯 AI prompt updated with ${examples.length} training examples`);

    res.json({
      success: true,
      message: `AI prompt updated with ${examples.length} training examples`,
      examplesUsed: examples.length
    });
  } catch (error) {
    console.error('Error updating AI prompt:', error);
    res.status(500).json({ error: 'Failed to update AI prompt' });
  }
});

// Generate enhanced prompt based on training examples
function generateEnhancedPrompt(examples) {
  let prompt = `You are a mortgage loan processor analyzing a call transcript. Extract the following information:

1. BORROWER INFORMATION:
   - Full name
   - Phone number
   - Email address
   - Current address
   - SSN (if mentioned)
   - Date of birth

2. LOAN DETAILS:
   - Loan purpose (purchase/refinance/cash-out/HELOC)
   - Requested loan amount
   - Property address
   - Property type (single family/condo/multi-family)
   - Occupancy (primary/investment/second home)
   - Purchase price

3. FINANCIAL INFORMATION:
   - Credit score or range
   - Annual income
   - Employment status
   - Employer name
   - Down payment amount
   - Monthly debts
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
   - Questions or concerns

6. SUMMARY:
   - Brief overview of the call (2-3 sentences)
   - Key concerns or questions from borrower

TRAINING EXAMPLES FROM YOUR ORGANIZATION:
`;

  // Add specific examples from training data
  examples.slice(0, 5).forEach((example, index) => {
    prompt += `\nExample ${index + 1}:\n`;
    for (const [field, values] of Object.entries(example.fields)) {
      if (values && values.length > 0) {
        prompt += `- ${field}: "${values[0].text}"\n`;
      }
    }
  });

  prompt += `\n\nBased on these examples and patterns, extract similar information from the transcript.
Return the data as JSON. Use null for any fields not mentioned in the transcript.
Pay special attention to the patterns shown in the training examples above.`;

  return prompt;
}

// Delete training data for a recording
router.delete('/:recordingSid', async (req, res) => {
  try {
    const { recordingSid } = req.params;
    const trainingFile = path.join(TRAINING_DATA_DIR, `${recordingSid}.json`);

    await fs.unlink(trainingFile);

    res.json({
      success: true,
      message: 'Training data deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting training data:', error);
    res.status(500).json({ error: 'Failed to delete training data' });
  }
});

module.exports = router;