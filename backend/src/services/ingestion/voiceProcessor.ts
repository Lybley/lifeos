/**
 * Voice Message Processing Service
 * 
 * Uses Whisper for speech-to-text transcription
 */

import { VoiceMessage, IngestionType, TranscribedWord } from './multiModalModels';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// ============================================================================
// VOICE PROCESSOR CLASS
// ============================================================================

export class VoiceProcessor {
  private whisperModel: string;
  private tempDir: string;
  
  constructor(whisperModel: string = 'base') {
    this.whisperModel = whisperModel;
    this.tempDir = process.env.TEMP_DIR || '/tmp/voice-processing';
  }
  
  /**
   * Process voice message and transcribe with Whisper
   */
  async processVoiceMessage(
    audioBuffer: Buffer,
    userId: string,
    metadata: {
      format: string;
      source: string;
      capturedAt?: Date;
    }
  ): Promise<VoiceMessage> {
    const ingestionId = uuidv4();
    
    logger.info('Processing voice message', {
      ingestionId,
      userId,
      size: audioBuffer.length,
      format: metadata.format,
    });
    
    try {
      // Create temp directory
      await fs.mkdir(this.tempDir, { recursive: true });
      
      // Save audio to temp file
      const tempAudioPath = path.join(this.tempDir, `${ingestionId}.${metadata.format}`);
      await fs.writeFile(tempAudioPath, audioBuffer);
      
      // Extract audio metadata
      const audioMetadata = await this.extractAudioMetadata(tempAudioPath, metadata.format);
      
      // Transcribe with Whisper
      const transcription = await this.transcribeWithWhisper(tempAudioPath);
      
      // Detect emotion from audio (simple heuristic)
      const emotion = this.detectEmotion(transcription.text);
      
      // Clean up temp file
      await fs.unlink(tempAudioPath);
      
      const voiceMessage: VoiceMessage = {
        id: ingestionId,
        userId,
        type: IngestionType.VOICE_MESSAGE,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: audioBuffer.toString('base64'),
        status: 'completed',
        audioMetadata: {
          duration: audioMetadata.duration,
          format: metadata.format as any,
          sampleRate: audioMetadata.sampleRate,
          channels: audioMetadata.channels,
          bitrate: audioMetadata.bitrate,
          size: audioBuffer.length,
        },
        transcription: {
          text: transcription.text,
          language: transcription.language,
          confidence: transcription.confidence,
          words: transcription.words,
        },
        audioAnalysis: {
          volume: audioMetadata.volume,
          tempo: 120, // Default, can be computed with librosa
          emotion,
          backgroundNoise: audioMetadata.noise,
        },
        metadata: {
          processingTime: Date.now(),
          whisperModel: this.whisperModel,
        },
        tags: this.extractTags(transcription.text),
      };
      
      logger.info('Voice message processed successfully', {
        ingestionId,
        transcriptionLength: transcription.text.length,
        language: transcription.language,
      });
      
      return voiceMessage;
      
    } catch (error) {
      logger.error('Failed to process voice message', { error, ingestionId });
      
      return {
        id: ingestionId,
        userId,
        type: IngestionType.VOICE_MESSAGE,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: audioBuffer.toString('base64'),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        audioMetadata: {
          duration: 0,
          format: metadata.format as any,
          sampleRate: 0,
          channels: 0,
          bitrate: 0,
          size: audioBuffer.length,
        },
        metadata: {},
        tags: [],
      };
    }
  }
  
  /**
   * Transcribe audio using Whisper
   */
  private async transcribeWithWhisper(audioPath: string): Promise<{
    text: string;
    language: string;
    confidence: number;
    words: TranscribedWord[];
  }> {
    try {
      // Using whisper.cpp or OpenAI Whisper API
      // For local: whisper.cpp command
      // For API: OpenAI API call
      
      // Example: Using OpenAI Whisper API
      if (process.env.USE_OPENAI_WHISPER === 'true') {
        return await this.transcribeWithOpenAI(audioPath);
      }
      
      // Example: Using whisper.cpp (local)
      const outputPath = audioPath.replace(/\.[^/.]+$/, '.json');
      const command = `whisper ${audioPath} --model ${this.whisperModel} --output_format json --output_dir ${this.tempDir}`;
      
      await execAsync(command);
      
      const resultJson = await fs.readFile(outputPath, 'utf-8');
      const result = JSON.parse(resultJson);
      
      // Parse Whisper output
      const words: TranscribedWord[] = result.segments?.flatMap((seg: any) => 
        seg.words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.probability || 0.9,
        })) || []
      ) || [];
      
      return {
        text: result.text || '',
        language: result.language || 'en',
        confidence: result.segments?.[0]?.avg_logprob ? Math.exp(result.segments[0].avg_logprob) : 0.85,
        words,
      };
      
    } catch (error) {
      logger.error('Whisper transcription failed', { error });
      
      // Fallback to mock transcription for testing
      return {
        text: '[Transcription unavailable]',
        language: 'en',
        confidence: 0,
        words: [],
      };
    }
  }
  
  /**
   * Transcribe using OpenAI Whisper API
   */
  private async transcribeWithOpenAI(audioPath: string): Promise<{
    text: string;
    language: string;
    confidence: number;
    words: TranscribedWord[];
  }> {
    try {
      const FormData = require('form-data');
      const axios = require('axios');
      
      const form = new FormData();
      form.append('file', await fs.readFile(audioPath), 'audio.mp3');
      form.append('model', 'whisper-1');
      form.append('response_format', 'verbose_json');
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );
      
      const data = response.data;
      
      return {
        text: data.text,
        language: data.language || 'en',
        confidence: 0.9,
        words: data.words || [],
      };
      
    } catch (error) {
      logger.error('OpenAI Whisper API failed', { error });
      throw error;
    }
  }
  
  /**
   * Extract audio metadata using ffprobe
   */
  private async extractAudioMetadata(audioPath: string, format: string): Promise<{
    duration: number;
    sampleRate: number;
    channels: number;
    bitrate: number;
    volume: number;
    noise: number;
  }> {
    try {
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${audioPath}"`;
      const { stdout } = await execAsync(command);
      const data = JSON.parse(stdout);
      
      const audioStream = data.streams.find((s: any) => s.codec_type === 'audio');
      
      return {
        duration: parseFloat(data.format.duration) || 0,
        sampleRate: parseInt(audioStream?.sample_rate) || 44100,
        channels: parseInt(audioStream?.channels) || 1,
        bitrate: parseInt(data.format.bit_rate) || 128000,
        volume: 0.7, // Placeholder, would need audio analysis
        noise: 0.2, // Placeholder
      };
      
    } catch (error) {
      logger.warn('Failed to extract audio metadata', { error });
      
      return {
        duration: 0,
        sampleRate: 44100,
        channels: 1,
        bitrate: 128000,
        volume: 0.5,
        noise: 0.3,
      };
    }
  }
  
  /**
   * Simple emotion detection from text
   */
  private detectEmotion(text: string): 'neutral' | 'happy' | 'sad' | 'angry' | 'excited' {
    const lowerText = text.toLowerCase();
    
    // Simple keyword-based emotion detection
    if (lowerText.match(/happy|joy|great|awesome|love|wonderful/)) {
      return 'happy';
    } else if (lowerText.match(/sad|sorry|miss|unfortunately|regret/)) {
      return 'sad';
    } else if (lowerText.match(/angry|mad|furious|hate|terrible/)) {
      return 'angry';
    } else if (lowerText.match(/!{2,}|excited|amazing|wow|omg/)) {
      return 'excited';
    }
    
    return 'neutral';
  }
  
  /**
   * Extract tags from transcription
   */
  private extractTags(text: string): string[] {
    const tags: string[] = [];
    
    // Simple keyword extraction
    const keywords = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const uniqueKeywords = [...new Set(keywords)];
    
    // Take top 5 most common words
    const wordCounts = new Map<string, number>();
    keywords.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
    
    const sortedWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    tags.push(...sortedWords);
    
    // Add context tags
    if (text.match(/meeting|call|discussion/i)) tags.push('meeting');
    if (text.match(/reminder|todo|task/i)) tags.push('task');
    if (text.match(/note|memo/i)) tags.push('note');
    
    return [...new Set(tags)];
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const voiceProcessor = new VoiceProcessor();
