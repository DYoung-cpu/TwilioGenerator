const mongoose = require('mongoose');

const CallRecordSchema = new mongoose.Schema({
  // Twilio identifiers
  callSid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  recordingSid: {
    type: String,
    index: true
  },

  // Borrower information
  borrowerInfo: {
    fullName: String,
    phoneNumber: String,
    emailAddress: String,
    currentAddress: String,
    ssn: String,
    dateOfBirth: Date
  },

  // Loan details
  loanDetails: {
    loanPurpose: {
      type: String,
      enum: ['purchase', 'refinance', 'cash-out', 'HELOC', 'other']
    },
    requestedAmount: Number,
    propertyAddress: String,
    propertyType: {
      type: String,
      enum: ['single-family', 'condo', 'multi-family', 'townhouse', 'other']
    },
    occupancy: {
      type: String,
      enum: ['primary', 'investment', 'second-home']
    },
    purchasePrice: Number
  },

  // Financial information
  financialInfo: {
    creditScore: Number,
    annualIncome: Number,
    employmentStatus: String,
    employerName: String,
    downPaymentAmount: Number,
    monthlyDebts: Number,
    currentMortgageRate: Number,
    currentMortgagePayment: Number,
    currentLender: String
  },

  // Call metadata
  callMetadata: {
    dateTime: {
      type: Date,
      default: Date.now
    },
    duration: Number, // in seconds
    loanOfficer: String,
    direction: {
      type: String,
      enum: ['inbound', 'outbound']
    },
    status: {
      type: String,
      enum: ['completed', 'no-answer', 'busy', 'failed']
    }
  },

  // Transcription data
  transcription: {
    text: String,
    utterances: [{
      speaker: String,
      text: String,
      start: Number,
      end: Number
    }],
    completedAt: Date,
    provider: {
      type: String,
      enum: ['assemblyai', 'deepgram', 'twilio']
    }
  },

  // AI-extracted data
  aiExtraction: {
    extractedData: mongoose.Schema.Types.Mixed,
    actionItems: [{
      task: String,
      priority: {
        type: String,
        enum: ['high', 'medium', 'low']
      },
      dueDate: Date,
      completed: {
        type: Boolean,
        default: false
      }
    }],
    sentiment: {
      overall: {
        type: String,
        enum: ['positive', 'neutral', 'negative']
      },
      urgency: {
        type: String,
        enum: ['high', 'medium', 'low']
      },
      concerns: [String],
      opportunities: [String]
    },
    confidenceScore: Number,
    extractedAt: Date
  },

  // Email notifications
  notifications: {
    loanOfficerEmail: {
      sent: Boolean,
      sentAt: Date,
      messageId: String,
      recipient: String
    },
    customerFollowUp: {
      sent: Boolean,
      sentAt: Date,
      messageId: String,
      recipient: String
    }
  },

  // Training data
  training: {
    isTrainingData: {
      type: Boolean,
      default: false
    },
    markedFields: mongoose.Schema.Types.Mixed,
    trainedBy: String,
    trainedAt: Date
  },

  // Notes and follow-up
  notes: [{
    text: String,
    addedBy: String,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Status tracking
  status: {
    isProcessed: {
      type: Boolean,
      default: false
    },
    needsReview: {
      type: Boolean,
      default: false
    },
    isArchived: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better query performance
CallRecordSchema.index({ 'borrowerInfo.phoneNumber': 1 });
CallRecordSchema.index({ 'borrowerInfo.emailAddress': 1 });
CallRecordSchema.index({ 'callMetadata.dateTime': -1 });
CallRecordSchema.index({ 'callMetadata.loanOfficer': 1 });
CallRecordSchema.index({ 'status.isProcessed': 1 });
CallRecordSchema.index({ 'status.needsReview': 1 });

// Virtual for full address
CallRecordSchema.virtual('fullPropertyAddress').get(function() {
  return this.loanDetails.propertyAddress || this.borrowerInfo.currentAddress;
});

// Method to check if action items are overdue
CallRecordSchema.methods.getOverdueActionItems = function() {
  const now = new Date();
  return this.aiExtraction.actionItems.filter(item =>
    !item.completed && item.dueDate && item.dueDate < now
  );
};

// Static method to find calls needing follow-up
CallRecordSchema.statics.findNeedingFollowUp = function() {
  return this.find({
    'status.isProcessed': true,
    'status.needsReview': true,
    'status.isArchived': false
  });
};

// Static method to get calls by loan officer
CallRecordSchema.statics.findByLoanOfficer = function(loanOfficerName) {
  return this.find({
    'callMetadata.loanOfficer': loanOfficerName
  }).sort({ 'callMetadata.dateTime': -1 });
};

// Pre-save hook to update status
CallRecordSchema.pre('save', function(next) {
  // Mark as processed if we have AI extraction
  if (this.aiExtraction && this.aiExtraction.extractedData) {
    this.status.isProcessed = true;
  }

  // Mark for review if confidence is low
  if (this.aiExtraction && this.aiExtraction.confidenceScore < 70) {
    this.status.needsReview = true;
  }

  next();
});

const CallRecord = mongoose.model('CallRecord', CallRecordSchema);

module.exports = CallRecord;