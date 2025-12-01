/**
 * File Processor - Download and ingest files into PMG
 */

import { DriveClient, DriveFile } from './driveClient';
import { postgresClient, neo4jDriver } from '../config/databases';
import logger from '../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function processFile(
  userId: string,
  file: DriveFile
): Promise<void> {
  logger.info(`Processing Drive file: ${file.name} (${file.id})`);

  try {
    const driveClient = new DriveClient(userId);

    // Check if file should be processed
    if (!shouldProcessFile(file)) {
      logger.info(`Skipping file ${file.name} (unsupported type: ${file.mimeType})`);
      return;
    }

    // Download or export file content
    let fileBuffer: Buffer;
    let finalMimeType = file.mimeType;

    if (isGoogleWorkspaceFile(file.mimeType)) {
      logger.info(`Exporting Google Workspace file: ${file.name}`);
      fileBuffer = await driveClient.exportFile(file.id, file.mimeType);
      finalMimeType = 'application/pdf'; // Exported as PDF
    } else {
      logger.info(`Downloading file: ${file.name}`);
      fileBuffer = await driveClient.downloadFile(file.id);
    }

    // Save to temp file
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `drive-${file.id}${getFileExtension(finalMimeType)}`);
    await fs.writeFile(tempFilePath, fileBuffer);

    logger.info(`File saved to: ${tempFilePath}`);

    // Send to ingest service
    const ingestServiceUrl = process.env.INGEST_SERVICE_URL || 'http://localhost:8001';

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: file.name,
      contentType: finalMimeType,
    });
    formData.append('userId', userId);
    formData.append('title', file.name);

    const response = await axios.post(
      `${ingestServiceUrl}/ingest/upload`,
      formData,
      {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    logger.info(`File ingested successfully: ${file.name}`);

    // Store Drive file metadata in PostgreSQL
    await storeDriveMetadata(userId, file, response.data.data.documentId);

    // Create Document node in Neo4j with Drive metadata
    await createDriveDocumentNode(userId, file, response.data.data.documentId);

    // Cleanup temp file
    await fs.unlink(tempFilePath).catch(() => {});

    logger.info(`Successfully processed file: ${file.name}`);
  } catch (error) {
    logger.error(`Failed to process file ${file.name}:`, error);
    throw error;
  }
}

function shouldProcessFile(file: DriveFile): boolean {
  const supportedTypes = (
    process.env.SUPPORTED_MIME_TYPES || ''
  ).split(',');

  // Always process Google Workspace files
  if (isGoogleWorkspaceFile(file.mimeType)) {
    return true;
  }

  return supportedTypes.some((type) => file.mimeType.includes(type));
}

function isGoogleWorkspaceFile(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.');
}

function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'image/png': '.png',
    'image/jpeg': '.jpg',
  };
  return extensions[mimeType] || '';
}

async function storeDriveMetadata(
  userId: string,
  file: DriveFile,
  documentId: string
): Promise<void> {
  const query = `
    INSERT INTO drive_files (
      id, user_id, drive_file_id, pmg_document_id,
      file_name, mime_type, file_size, web_view_link,
      created_time, modified_time, synced_at, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    ON CONFLICT (user_id, drive_file_id)
    DO UPDATE SET
      pmg_document_id = EXCLUDED.pmg_document_id,
      modified_time = EXCLUDED.modified_time,
      synced_at = NOW()
  `;

  await postgresClient.query(query, [
    uuidv4(),
    userId,
    file.id,
    documentId,
    file.name,
    file.mimeType,
    file.size ? parseInt(file.size) : 0,
    file.webViewLink || null,
    file.createdTime,
    file.modifiedTime,
  ]);

  logger.info(`Stored Drive metadata for: ${file.name}`);
}

async function createDriveDocumentNode(
  userId: string,
  file: DriveFile,
  documentId: string
): Promise<void> {
  const session = neo4jDriver.session();

  try {
    // Update document node with Drive metadata
    const query = `
      MATCH (d:Document {id: $documentId})
      SET d.drive_file_id = $driveFileId,
          d.drive_link = $webViewLink,
          d.source = 'google_drive'
      RETURN d
    `;

    await session.run(query, {
      documentId,
      driveFileId: file.id,
      webViewLink: file.webViewLink || '',
    });

    logger.info(`Updated Neo4j document node with Drive metadata: ${documentId}`);
  } finally {
    await session.close();
  }
}

export async function processBatch(
  userId: string,
  files: DriveFile[]
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await processFile(userId, file);
      processed++;
    } catch (error) {
      logger.error(`Failed to process file:`, error);
      failed++;
    }
  }

  return { processed, failed };
}
