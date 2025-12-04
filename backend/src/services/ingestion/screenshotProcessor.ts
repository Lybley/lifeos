/**
 * Screenshot Processing Service
 * 
 * OCR, classification, and intelligent chunking for screenshots
 */

import {
  ScreenshotIngestion,
  IngestionType,
  TextBlock,
  ContentChunk,
  UIElement,
  BoundingBox,
} from './multiModalModels';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import sharp from 'sharp';

// ============================================================================
// SCREENSHOT PROCESSOR CLASS
// ============================================================================

export class ScreenshotProcessor {
  private chunkSize: number;
  private chunkOverlap: number;
  
  constructor(chunkSize: number = 500, chunkOverlap: number = 50) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }
  
  /**
   * Process screenshot with OCR and classification
   */
  async processScreenshot(
    imageBuffer: Buffer,
    userId: string,
    metadata: {
      deviceType: 'desktop' | 'mobile' | 'tablet';
      application?: string;
      source: string;
      capturedAt?: Date;
    }
  ): Promise<ScreenshotIngestion> {
    const ingestionId = uuidv4();
    
    logger.info('Processing screenshot', {
      ingestionId,
      userId,
      size: imageBuffer.length,
      deviceType: metadata.deviceType,
    });
    
    try {
      // Extract image metadata
      const imageMetadata = await sharp(imageBuffer).metadata();
      
      // Perform OCR
      const ocrResults = await this.performOCR(imageBuffer);
      
      // Classify screenshot type
      const classification = await this.classifyScreenshot(ocrResults.fullText, metadata.application);
      
      // Create content chunks
      const chunks = await this.createChunks(ocrResults.blocks);
      
      // Detect UI elements (optional)
      const uiElements = await this.detectUIElements(imageBuffer);
      
      const screenshotIngestion: ScreenshotIngestion = {
        id: ingestionId,
        userId,
        type: IngestionType.SCREENSHOT,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: imageBuffer.toString('base64'),
        status: 'completed',
        screenshotMetadata: {
          width: imageMetadata.width || 0,
          height: imageMetadata.height || 0,
          format: 'png',
          size: imageBuffer.length,
          deviceType: metadata.deviceType,
          application: metadata.application,
        },
        ocrResults,
        classification,
        chunks,
        uiElements,
        metadata: {
          processingTime: Date.now(),
          ocrEngine: 'tesseract',
        },
        tags: this.extractTags(ocrResults.fullText, classification),
      };
      
      logger.info('Screenshot processed successfully', {
        ingestionId,
        textLength: ocrResults.fullText.length,
        chunksCreated: chunks.length,
      });
      
      return screenshotIngestion;
      
    } catch (error) {
      logger.error('Failed to process screenshot', { error, ingestionId });
      
      const basicMetadata = await sharp(imageBuffer).metadata().catch(() => ({
        width: 0,
        height: 0,
      }));
      
      return {
        id: ingestionId,
        userId,
        type: IngestionType.SCREENSHOT,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: imageBuffer.toString('base64'),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        screenshotMetadata: {
          width: basicMetadata.width || 0,
          height: basicMetadata.height || 0,
          format: 'png',
          size: imageBuffer.length,
          deviceType: metadata.deviceType,
        },
        metadata: {},
        tags: [],
      };
    }
  }
  
  /**
   * Perform OCR on screenshot
   */
  private async performOCR(imageBuffer: Buffer): Promise<{
    fullText: string;
    confidence: number;
    blocks: TextBlock[];
    language: string;
  }> {
    try {
      const Tesseract = require('tesseract.js');
      
      // Preprocess image for better OCR
      const processedImage = await sharp(imageBuffer)
        .greyscale()
        .normalize()
        .toBuffer();
      
      const result = await Tesseract.recognize(processedImage, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });
      
      // Parse blocks
      const blocks: TextBlock[] = result.data.blocks?.map((block: any) => ({
        text: block.text,
        confidence: block.confidence / 100,
        boundingBox: {
          x: block.bbox.x0,
          y: block.bbox.y0,
          width: block.bbox.x1 - block.bbox.x0,
          height: block.bbox.y1 - block.bbox.y0,
        },
        type: this.classifyTextBlock(block.text),
      })) || [];
      
      return {
        fullText: result.data.text,
        confidence: result.data.confidence / 100,
        blocks,
        language: 'en',
      };
      
    } catch (error) {
      logger.error('OCR failed', { error });
      
      return {
        fullText: '',
        confidence: 0,
        blocks: [],
        language: 'en',
      };
    }
  }
  
  /**
   * Classify text block type
   */
  private classifyTextBlock(text: string): 'paragraph' | 'heading' | 'list' | 'code' | 'table' {
    const trimmed = text.trim();
    
    // Heading: short, all caps or title case
    if (trimmed.length < 50 && (trimmed === trimmed.toUpperCase() || /^[A-Z]/.test(trimmed))) {
      return 'heading';
    }
    
    // Code: contains special characters, indentation
    if (/^[\s{}\[\]();]+/.test(trimmed) || trimmed.includes('function') || trimmed.includes('class')) {
      return 'code';
    }
    
    // List: starts with bullet or number
    if (/^[\-\*•\d+\.]/.test(trimmed)) {
      return 'list';
    }
    
    // Table: contains pipes or tabs
    if (trimmed.includes('|') || trimmed.includes('\t')) {
      return 'table';
    }
    
    return 'paragraph';
  }
  
  /**
   * Classify screenshot type
   */
  private async classifyScreenshot(text: string, application?: string): Promise<{
    type: 'document' | 'webpage' | 'chat' | 'code' | 'email' | 'social' | 'other';
    confidence: number;
    application?: string;
  }> {
    const lowerText = text.toLowerCase();
    
    // Application-based classification
    if (application) {
      if (application.includes('code') || application.includes('vscode')) {
        return { type: 'code', confidence: 0.9, application };
      }
      if (application.includes('slack') || application.includes('teams')) {
        return { type: 'chat', confidence: 0.9, application };
      }
      if (application.includes('mail') || application.includes('outlook')) {
        return { type: 'email', confidence: 0.9, application };
      }
    }
    
    // Content-based classification
    if (lowerText.includes('function') || lowerText.includes('const') || lowerText.includes('import')) {
      return { type: 'code', confidence: 0.85 };
    }
    
    if (lowerText.includes('from:') || lowerText.includes('to:') || lowerText.includes('subject:')) {
      return { type: 'email', confidence: 0.85 };
    }
    
    if (lowerText.includes('http://') || lowerText.includes('https://')) {
      return { type: 'webpage', confidence: 0.75 };
    }
    
    if (lowerText.match(/\d{1,2}:\d{2}\s*(am|pm)/i)) {
      return { type: 'chat', confidence: 0.7 };
    }
    
    if (lowerText.includes('page') && lowerText.includes('of')) {
      return { type: 'document', confidence: 0.8 };
    }
    
    return { type: 'other', confidence: 0.5 };
  }
  
  /**
   * Create semantic chunks from text blocks
   */
  private async createChunks(blocks: TextBlock[]): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    let currentChunk = '';
    let currentType: ContentChunk['type'] = 'paragraph';
    let chunkPosition = 0;
    
    for (const block of blocks) {
      const blockText = block.text.trim();
      
      if (!blockText) continue;
      
      // If adding this block exceeds chunk size, save current chunk
      if (currentChunk.length + blockText.length > this.chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: uuidv4(),
          text: currentChunk.trim(),
          type: currentType,
          position: chunkPosition++,
        });
        
        // Start new chunk with overlap
        const overlapText = currentChunk.slice(-this.chunkOverlap);
        currentChunk = overlapText + ' ' + blockText;
        currentType = block.type;
      } else {
        // Add to current chunk
        currentChunk += (currentChunk ? ' ' : '') + blockText;
        
        // Update type if mixed
        if (currentType !== block.type) {
          currentType = 'mixed';
        }
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: uuidv4(),
        text: currentChunk.trim(),
        type: currentType,
        position: chunkPosition,
      });
    }
    
    return chunks;
  }
  
  /**
   * Detect UI elements (simplified)
   */
  private async detectUIElements(imageBuffer: Buffer): Promise<UIElement[]> {
    // This would use computer vision to detect buttons, inputs, etc.
    // For now, return empty array
    // Could integrate with OpenCV or custom ML model
    
    return [];
  }
  
  /**
   * Extract tags from screenshot
   */
  private extractTags(text: string, classification: any): string[] {
    const tags: string[] = [];
    
    // Add classification type
    tags.push(classification.type);
    
    // Add application if available
    if (classification.application) {
      tags.push(classification.application.toLowerCase());
    }
    
    // Extract keywords
    const keywords = text
      .toLowerCase()
      .match(/\b\w{4,}\b/g) || [];
    
    const wordCounts = new Map<string, number>();
    keywords.forEach(word => {
      if (!['that', 'this', 'with', 'have', 'from', 'they', 'been', 'were'].includes(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });
    
    const topWords = [...wordCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
    
    tags.push(...topWords);
    
    return [...new Set(tags)].slice(0, 10);
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const screenshotProcessor = new ScreenshotProcessor();
