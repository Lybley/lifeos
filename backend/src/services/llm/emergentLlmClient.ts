/**
 * Emergent LLM Client - Unified interface for multiple LLM providers
 * Supports: OpenAI, Anthropic Claude, Google Gemini
 * Uses Emergent Universal Key for authentication
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../../utils/logger';

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

export abstract class BaseLLMClient {
  protected config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  abstract chat(messages: LLMMessage[]): Promise<LLMResponse>;
  
  getModel(): string {
    return this.config.model;
  }

  getProvider(): LLMProvider {
    return this.config.provider;
  }
}

/**
 * OpenAI Client
 */
export class OpenAILLMClient extends BaseLLMClient {
  private client: OpenAI;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: config.apiKey,
    });
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 1000,
        top_p: this.config.topP ?? 1.0,
      });

      const choice = response.choices[0];

      return {
        content: choice.message.content || '',
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      logger.error('OpenAI chat completion failed:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }
  }
}

/**
 * Anthropic Claude Client
 */
export class AnthropicLLMClient extends BaseLLMClient {
  private client: Anthropic;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      // Separate system message from conversation
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.client.messages.create({
        model: this.config.model,
        system: systemMessage?.content,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        })),
        temperature: this.config.temperature ?? 0.7,
        max_tokens: this.config.maxTokens ?? 1000,
        top_p: this.config.topP ?? 1.0,
      });

      const content = response.content[0];
      const textContent = content.type === 'text' ? content.text : '';

      return {
        content: textContent,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        finishReason: response.stop_reason || 'complete',
      };
    } catch (error) {
      logger.error('Anthropic chat completion failed:', error);
      throw new Error(`Anthropic API error: ${error}`);
    }
  }
}

/**
 * Google Gemini Client
 */
export class GeminiLLMClient extends BaseLLMClient {
  private client: GoogleGenerativeAI;

  constructor(config: LLMConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    try {
      const model = this.client.getGenerativeModel({ model: this.config.model });

      // Combine system and user messages for Gemini
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role === 'user');
      
      let prompt = '';
      if (systemMessage) {
        prompt += `${systemMessage.content}\n\n`;
      }
      prompt += userMessages.map(m => m.content).join('\n\n');

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: this.config.temperature ?? 0.7,
          maxOutputTokens: this.config.maxTokens ?? 1000,
          topP: this.config.topP ?? 1.0,
        },
      });

      const response = result.response;
      const text = response.text();

      return {
        content: text,
        model: this.config.model,
        usage: {
          promptTokens: response.usageMetadata?.promptTokenCount || 0,
          completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata?.totalTokenCount || 0,
        },
        finishReason: 'complete',
      };
    } catch (error) {
      logger.error('Gemini chat completion failed:', error);
      throw new Error(`Gemini API error: ${error}`);
    }
  }
}

/**
 * Factory function to create LLM client
 */
export function createLLMClient(config: LLMConfig): BaseLLMClient {
  switch (config.provider) {
    case 'openai':
      return new OpenAILLMClient(config);
    
    case 'anthropic':
      return new AnthropicLLMClient(config);
    
    case 'gemini':
      return new GeminiLLMClient(config);
    
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

/**
 * Get default LLM client from environment
 * Prioritizes Emergent Universal Key if available
 */
export function getDefaultLLMClient(): BaseLLMClient {
  const provider = (process.env.LLM_PROVIDER || 'openai') as LLMProvider;
  const apiKey = process.env.EMERGENT_LLM_KEY || process.env.OPENAI_API_KEY || '';
  
  // Default models for each provider
  const defaultModels: Record<LLMProvider, string> = {
    openai: 'gpt-4-turbo-preview',
    anthropic: 'claude-3-sonnet-20240229',
    gemini: 'gemini-pro',
  };

  const model = process.env.LLM_MODEL || defaultModels[provider];

  if (!apiKey) {
    throw new Error('No API key found. Set EMERGENT_LLM_KEY or OPENAI_API_KEY');
  }

  return createLLMClient({
    provider,
    model,
    apiKey,
    temperature: 0.2, // Lower for factual RAG responses
    maxTokens: 1500,
    topP: 0.9,
  });
}
