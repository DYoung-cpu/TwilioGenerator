const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // MongoDB connection string
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lendwise-twilio';

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ MongoDB connected successfully');

    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    // Don't exit - allow app to run without database
    return null;
  }
};

module.exports = connectDB;