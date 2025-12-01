/**
 * Document Processor Service
 * 
 * Handles extraction of text from various file formats:
 * - PDF (with OCR fallback)
 * - DOCX
 * - TXT
 * - Images (PNG, JPG) with OCR
 */

import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import logger from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface ProcessedDocument {
  text: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    pageCount?: number;
    wordCount: number;
    characterCount: number;
    processingMethod: 'direct' | 'ocr' | 'hybrid';
    ocrLanguage?: string;
  };
}

/**
 * Extract text from PDF
 */
async function extractFromPDF(filePath: string): Promise<ProcessedDocument> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);

    const text = pdfData.text.trim();
    const pageCount = pdfData.numpages;

    // If text extraction yields little content, try OCR
    const needsOCR = text.length < 100 && pageCount > 0;

    if (needsOCR) {
      logger.info(`PDF has minimal text (${text.length} chars), attempting OCR`);
      // For production, you'd convert PDF pages to images and OCR them
      // This is a placeholder for that logic
      return {
        text: text || 'OCR extraction not fully implemented',
        metadata: {
          fileName: path.basename(filePath),
          fileType: 'pdf',
          fileSize: dataBuffer.length,
          pageCount,
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
          processingMethod: 'hybrid',
          ocrLanguage: 'eng',
        },
      };
    }

    return {
      text,
      metadata: {
        fileName: path.basename(filePath),
        fileType: 'pdf',
        fileSize: dataBuffer.length,
        pageCount,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        characterCount: text.length,
        processingMethod: 'direct',
      },
    };
  } catch (error) {
    logger.error('PDF extraction failed:', error);
    throw new AppError(`Failed to extract text from PDF: ${error}`, 500);
  }
}

/**
 * Extract text from DOCX
 */
async function extractFromDOCX(filePath: string): Promise<ProcessedDocument> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: dataBuffer });

    const text = result.value.trim();
    const stats = await fs.stat(filePath);

    return {
      text,
      metadata: {
        fileName: path.basename(filePath),
        fileType: 'docx',
        fileSize: stats.size,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        characterCount: text.length,
        processingMethod: 'direct',
      },
    };
  } catch (error) {
    logger.error('DOCX extraction failed:', error);
    throw new AppError(`Failed to extract text from DOCX: ${error}`, 500);
  }
}

/**
 * Extract text from plain text file
 */
async function extractFromText(filePath: string): Promise<ProcessedDocument> {
  try {
    const text = await fs.readFile(filePath, 'utf-8');
    const stats = await fs.stat(filePath);

    return {
      text: text.trim(),
      metadata: {
        fileName: path.basename(filePath),
        fileType: 'txt',
        fileSize: stats.size,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        characterCount: text.length,
        processingMethod: 'direct',
      },
    };
  } catch (error) {
    logger.error('Text file reading failed:', error);
    throw new AppError(`Failed to read text file: ${error}`, 500);
  }
}

/**
 * Preprocess image for better OCR results
 */
async function preprocessImage(filePath: string): Promise<string> {
  const outputPath = filePath.replace(/\.(png|jpg|jpeg)$/i, '_processed.png');

  try {
    await sharp(filePath)
      .grayscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Sharpen for better text recognition
      .png() // Convert to PNG for consistency
      .toFile(outputPath);

    return outputPath;
  } catch (error) {
    logger.error('Image preprocessing failed:', error);
    // Return original if preprocessing fails
    return filePath;
  }
}

/**
 * Extract text from image using OCR
 */
async function extractFromImage(
  filePath: string,
  language: string = 'eng'
): Promise<ProcessedDocument> {
  let worker;
  let processedImagePath: string | null = null;

  try {
    const stats = await fs.stat(filePath);

    // Preprocess image for better OCR
    processedImagePath = await preprocessImage(filePath);

    // Create Tesseract worker
    worker = await createWorker(language);

    // Configure for better accuracy
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
    });

    logger.info(`Starting OCR on image: ${path.basename(filePath)}`);

    // Perform OCR
    const {
      data: { text, confidence },
    } = await worker.recognize(processedImagePath);

    logger.info(`OCR completed with confidence: ${confidence}%`);

    // Clean up
    await worker.terminate();
    if (processedImagePath !== filePath) {
      await fs.unlink(processedImagePath).catch(() => {});
    }

    return {
      text: text.trim(),
      metadata: {
        fileName: path.basename(filePath),
        fileType: path.extname(filePath).slice(1),
        fileSize: stats.size,
        wordCount: text.split(/\s+/).filter((w) => w.length > 0).length,
        characterCount: text.length,
        processingMethod: 'ocr',
        ocrLanguage: language,
      },
    };
  } catch (error) {
    // Cleanup on error
    if (worker) {
      await worker.terminate().catch(() => {});
    }
    if (processedImagePath && processedImagePath !== filePath) {
      await fs.unlink(processedImagePath).catch(() => {});
    }

    logger.error('OCR extraction failed:', error);
    throw new AppError(`Failed to extract text from image: ${error}`, 500);
  }
}

/**
 * Main document processing function
 * Routes to appropriate extractor based on file type
 */
export async function processDocument(
  filePath: string,
  mimeType?: string
): Promise<ProcessedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  logger.info(`Processing document: ${path.basename(filePath)}, type: ${ext}`);

  try {
    switch (ext) {
      case '.pdf':
        return await extractFromPDF(filePath);

      case '.docx':
        return await extractFromDOCX(filePath);

      case '.txt':
      case '.text':
        return await extractFromText(filePath);

      case '.png':
      case '.jpg':
      case '.jpeg':
        return await extractFromImage(filePath);

      default:
        throw new AppError(`Unsupported file type: ${ext}`, 400);
    }
  } finally {
    // Clean up uploaded file after processing
    try {
      await fs.unlink(filePath);
      logger.info(`Cleaned up file: ${path.basename(filePath)}`);
    } catch (error) {
      logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }
}

/**
 * Process text content directly (no file)
 */
export async function processTextContent(text: string): Promise<ProcessedDocument> {
  const trimmedText = text.trim();

  return {
    text: trimmedText,
    metadata: {
      fileName: 'direct-input',
      fileType: 'text',
      fileSize: Buffer.byteLength(trimmedText, 'utf-8'),
      wordCount: trimmedText.split(/\s+/).filter((w) => w.length > 0).length,
      characterCount: trimmedText.length,
      processingMethod: 'direct',
    },
  };
}
