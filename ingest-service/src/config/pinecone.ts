import { Pinecone } from '@pinecone-database/pinecone';
import logger from '../utils/logger';

let pineconeClient: Pinecone | null = null;

if (process.env.PINECONE_API_KEY) {
  pineconeClient = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  logger.info('Pinecone client initialized');
} else {
  logger.warn('PINECONE_API_KEY not provided, vector features will be disabled');
}

export { pineconeClient };
