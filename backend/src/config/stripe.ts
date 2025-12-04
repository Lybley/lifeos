import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const STRIPE_API_KEY = process.env.STRIPE_API_KEY || '';

if (!STRIPE_API_KEY) {
  throw new Error('STRIPE_API_KEY environment variable is required');
}

export const stripe = new Stripe(STRIPE_API_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
