import { Job } from 'bullmq';
import logger from '../utils/logger';

export const processDefaultJob = async (job: Job): Promise<any> => {
  logger.info(`Processing default job: ${job.name}`, job.data);
  
  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    status: 'completed',
    processedAt: new Date().toISOString(),
    result: 'Job processed successfully',
  };
};
