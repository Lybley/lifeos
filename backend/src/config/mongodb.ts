/**
 * MongoDB Configuration
 */

import { MongoClient } from 'mongodb';
import logger from '../utils/logger';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/lifeos';
const DB_NAME = process.env.DB_NAME || 'lifeos';

const mongoClient = new MongoClient(MONGO_URL);

let isConnected = false;

async function connectMongo() {
  if (!isConnected) {
    try {
      await mongoClient.connect();
      isConnected = true;
      logger.info('MongoDB connected successfully');
    } catch (error) {
      logger.error('MongoDB connection error:', error);
      throw error;
    }
  }
  return mongoClient;
}

// Connect on startup
connectMongo().catch(err => {
  logger.error('Failed to connect to MongoDB:', err);
});

export { mongoClient, connectMongo, DB_NAME };
