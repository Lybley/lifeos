/**
 * Image Processing Service
 * 
 * Handles image captioning, OCR, scene description, and object detection
 */

import {
  ImageIngestion,
  IngestionType,
  DetectedObject,
  DetectedFace,
  OCRResult,
  DominantColor,
  Label,
  BoundingBox,
} from './multiModalModels';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import sharp from 'sharp';

// ============================================================================
// IMAGE PROCESSOR CLASS
// ============================================================================

export class ImageProcessor {
  private visionProvider: 'openai' | 'google' | 'local';
  private tempDir: string;
  
  constructor(visionProvider: 'openai' | 'google' | 'local' = 'openai') {
    this.visionProvider = visionProvider;
    this.tempDir = process.env.TEMP_DIR || '/tmp/image-processing';
  }
  
  /**
   * Process image with comprehensive vision analysis
   */
  async processImage(
    imageBuffer: Buffer,
    userId: string,
    metadata: {
      format: string;
      source: string;
      capturedAt?: Date;
    }
  ): Promise<ImageIngestion> {
    const ingestionId = uuidv4();
    
    logger.info('Processing image', {
      ingestionId,
      userId,
      size: imageBuffer.length,
      format: metadata.format,
    });
    
    try {
      // Extract image metadata
      const imageMetadata = await this.extractImageMetadata(imageBuffer);
      
      // Generate thumbnail
      const thumbnail = await this.generateThumbnail(imageBuffer);
      
      // Perform vision analysis
      const visionAnalysis = await this.analyzeImage(imageBuffer);
      
      // Extract dominant colors
      const colors = await this.extractDominantColors(imageBuffer);
      
      // Classify image
      const classification = await this.classifyImage(visionAnalysis);
      
      const imageIngestion: ImageIngestion = {
        id: ingestionId,
        userId,
        type: IngestionType.IMAGE,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: imageBuffer.toString('base64'),
        thumbnailUrl: thumbnail ? `data:image/jpeg;base64,${thumbnail.toString('base64')}` : undefined,
        status: 'completed',
        imageMetadata: {
          width: imageMetadata.width,
          height: imageMetadata.height,
          format: metadata.format as any,
          size: imageBuffer.length,
          exif: imageMetadata.exif,
        },
        visionAnalysis: {
          caption: visionAnalysis.caption,
          captionConfidence: visionAnalysis.captionConfidence,
          sceneDescription: visionAnalysis.sceneDescription,
          objects: visionAnalysis.objects,
          faces: visionAnalysis.faces,
          text: visionAnalysis.text,
          colors,
          labels: visionAnalysis.labels,
        },
        classification,
        metadata: {
          processingTime: Date.now(),
          visionProvider: this.visionProvider,
        },
        tags: this.extractTags(visionAnalysis),
      };
      
      logger.info('Image processed successfully', {
        ingestionId,
        objectsDetected: visionAnalysis.objects.length,
        textDetected: visionAnalysis.text.length,
      });
      
      return imageIngestion;
      
    } catch (error) {
      logger.error('Failed to process image', { error, ingestionId });
      
      const basicMetadata = await this.extractImageMetadata(imageBuffer).catch(() => ({
        width: 0,
        height: 0,
        exif: {},
      }));
      
      return {
        id: ingestionId,
        userId,
        type: IngestionType.IMAGE,
        source: metadata.source,
        capturedAt: metadata.capturedAt || new Date(),
        rawContent: imageBuffer.toString('base64'),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        imageMetadata: {
          width: basicMetadata.width,
          height: basicMetadata.height,
          format: metadata.format as any,
          size: imageBuffer.length,
        },
        metadata: {},
        tags: [],
      };
    }
  }
  
  /**
   * Analyze image with vision AI
   */
  private async analyzeImage(imageBuffer: Buffer): Promise<{
    caption: string;
    captionConfidence: number;
    sceneDescription: string;
    objects: DetectedObject[];
    faces: DetectedFace[];
    text: OCRResult[];
    labels: Label[];
  }> {
    if (this.visionProvider === 'openai') {
      return await this.analyzeWithOpenAI(imageBuffer);
    } else if (this.visionProvider === 'google') {
      return await this.analyzeWithGoogleVision(imageBuffer);
    } else {
      return await this.analyzeLocally(imageBuffer);
    }
  }
  
  /**
   * Analyze with OpenAI Vision API
   */
  private async analyzeWithOpenAI(imageBuffer: Buffer): Promise<any> {
    try {
      const axios = require('axios');
      const base64Image = imageBuffer.toString('base64');
      
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this image and provide: 1) A brief caption, 2) Detailed scene description, 3) List of objects visible, 4) Any text present. Format as JSON.',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 1000,
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const analysis = response.data.choices[0].message.content;
      
      // Parse JSON response
      let parsed;
      try {
        parsed = JSON.parse(analysis);
      } catch {
        // Fallback if not JSON
        parsed = {
          caption: analysis.substring(0, 100),
          sceneDescription: analysis,
          objects: [],
          text: [],
        };
      }
      
      return {
        caption: parsed.caption || 'No caption available',
        captionConfidence: 0.85,
        sceneDescription: parsed.sceneDescription || parsed.caption || '',
        objects: (parsed.objects || []).map((obj: any) => ({
          name: obj.name || obj,
          confidence: obj.confidence || 0.8,
          boundingBox: obj.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
        })),
        faces: [],
        text: (parsed.text || []).map((t: any) => ({
          text: typeof t === 'string' ? t : t.text,
          confidence: t.confidence || 0.8,
          boundingBox: t.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
        })),
        labels: (parsed.labels || []).map((l: any) => ({
          name: typeof l === 'string' ? l : l.name,
          confidence: l.confidence || 0.8,
        })),
      };
      
    } catch (error) {
      logger.error('OpenAI Vision API failed', { error });
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Analyze with Google Cloud Vision API
   */
  private async analyzeWithGoogleVision(imageBuffer: Buffer): Promise<any> {
    try {
      // Would integrate with Google Cloud Vision
      // For now, return default
      logger.warn('Google Vision not implemented, using default analysis');
      return this.getDefaultAnalysis();
      
    } catch (error) {
      logger.error('Google Vision API failed', { error });
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Analyze with local models (Tesseract OCR + basic analysis)
   */
  private async analyzeLocally(imageBuffer: Buffer): Promise<any> {
    try {
      // Use Tesseract for OCR
      const ocrText = await this.performOCR(imageBuffer);
      
      return {
        caption: 'Image uploaded',
        captionConfidence: 0.5,
        sceneDescription: ocrText ? `Image contains text: ${ocrText.substring(0, 100)}...` : 'Image uploaded',
        objects: [],
        faces: [],
        text: ocrText ? [{
          text: ocrText,
          confidence: 0.7,
          boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        }] : [],
        labels: [],
      };
      
    } catch (error) {
      logger.error('Local analysis failed', { error });
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Perform OCR using Tesseract
   */
  private async performOCR(imageBuffer: Buffer): Promise<string> {
    try {
      const Tesseract = require('tesseract.js');
      
      const result = await Tesseract.recognize(imageBuffer, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });
      
      return result.data.text;
      
    } catch (error) {
      logger.warn('OCR failed', { error });
      return '';
    }
  }
  
  /**
   * Extract image metadata
   */
  private async extractImageMetadata(imageBuffer: Buffer): Promise<{
    width: number;
    height: number;
    exif: Record<string, any>;
  }> {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        exif: metadata.exif || {},
      };
      
    } catch (error) {
      logger.error('Failed to extract image metadata', { error });
      return { width: 0, height: 0, exif: {} };
    }
  }
  
  /**
   * Generate thumbnail
   */
  private async generateThumbnail(imageBuffer: Buffer, size: number = 256): Promise<Buffer> {
    try {
      return await sharp(imageBuffer)
        .resize(size, size, { fit: 'inside' })
        .jpeg({ quality: 80 })
        .toBuffer();
        
    } catch (error) {
      logger.error('Failed to generate thumbnail', { error });
      throw error;
    }
  }
  
  /**
   * Extract dominant colors
   */
  private async extractDominantColors(imageBuffer: Buffer): Promise<DominantColor[]> {
    try {
      const { dominant } = await sharp(imageBuffer)
        .resize(100, 100)
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Simple dominant color extraction (would use color-thief or similar)
      return [
        {
          rgb: [128, 128, 128],
          hex: '#808080',
          percentage: 0.5,
          name: 'gray',
        },
      ];
      
    } catch (error) {
      logger.error('Failed to extract colors', { error });
      return [];
    }
  }
  
  /**
   * Classify image
   */
  private async classifyImage(visionAnalysis: any): Promise<{
    category: string;
    subcategory?: string;
    confidence: number;
    tags: string[];
  }> {
    const labels = visionAnalysis.labels.map((l: Label) => l.name.toLowerCase());
    const hasText = visionAnalysis.text.length > 0;
    const hasFaces = visionAnalysis.faces.length > 0;
    
    // Simple classification logic
    let category = 'other';
    let subcategory;
    
    if (hasText && labels.includes('document')) {
      category = 'document';
    } else if (hasFaces) {
      category = 'people';
      subcategory = visionAnalysis.faces.length > 1 ? 'group' : 'portrait';
    } else if (labels.some(l => ['food', 'meal', 'restaurant'].includes(l))) {
      category = 'food';
    } else if (labels.some(l => ['nature', 'landscape', 'outdoor'].includes(l))) {
      category = 'nature';
    } else if (labels.some(l => ['screenshot', 'computer', 'phone'].includes(l))) {
      category = 'screenshot';
    }
    
    return {
      category,
      subcategory,
      confidence: 0.75,
      tags: labels.slice(0, 5),
    };
  }
  
  /**
   * Extract tags from vision analysis
   */
  private extractTags(visionAnalysis: any): string[] {
    const tags = new Set<string>();
    
    // Add labels as tags
    visionAnalysis.labels.forEach((label: Label) => {
      tags.add(label.name.toLowerCase());
    });
    
    // Add object names
    visionAnalysis.objects.forEach((obj: DetectedObject) => {
      tags.add(obj.name.toLowerCase());
    });
    
    // Add context tags
    if (visionAnalysis.faces.length > 0) tags.add('people');
    if (visionAnalysis.text.length > 0) tags.add('text');
    
    return Array.from(tags).slice(0, 10);
  }
  
  /**
   * Get default analysis for fallback
   */
  private getDefaultAnalysis() {
    return {
      caption: 'Image uploaded',
      captionConfidence: 0,
      sceneDescription: 'Image analysis unavailable',
      objects: [],
      faces: [],
      text: [],
      labels: [],
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const imageProcessor = new ImageProcessor();
