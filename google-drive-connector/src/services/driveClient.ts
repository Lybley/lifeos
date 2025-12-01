/**
 * Google Drive API Client
 */

import { google, drive_v3 } from 'googleapis';
import { getAuthenticatedClient } from './tokenManager';
import logger from '../utils/logger';
import axios from 'axios';
import { Readable } from 'stream';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
  parents?: string[];
}

export class DriveClient {
  private drive: drive_v3.Drive | null = null;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private async getDriveClient(): Promise<drive_v3.Drive> {
    if (!this.drive) {
      const auth = await getAuthenticatedClient(this.userId);
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  /**
   * List all files (with pagination)
   */
  async listFiles(
    pageToken?: string,
    pageSize: number = 100
  ): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
    const drive = await this.getDriveClient();

    const response = await drive.files.list({
      pageSize,
      pageToken,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, owners, parents)',
      orderBy: 'modifiedTime desc',
    });

    return {
      files: (response.data.files || []) as DriveFile[],
      nextPageToken: response.data.nextPageToken || undefined,
    };
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<DriveFile> {
    const drive = await this.getDriveClient();

    const response = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, owners, parents',
    });

    return response.data as DriveFile;
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    const drive = await this.getDriveClient();

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = response.data as Readable;

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Export Google Docs format to supported format
   */
  async exportFile(
    fileId: string,
    mimeType: string
  ): Promise<Buffer> {
    const drive = await this.getDriveClient();

    // Map Google Workspace types to export formats
    const exportMimeTypes: Record<string, string> = {
      'application/vnd.google-apps.document': 'application/pdf',
      'application/vnd.google-apps.spreadsheet': 'application/pdf',
      'application/vnd.google-apps.presentation': 'application/pdf',
    };

    const exportMimeType = exportMimeTypes[mimeType] || 'application/pdf';

    const response = await drive.files.export(
      { fileId, mimeType: exportMimeType },
      { responseType: 'stream' }
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = response.data as Readable;

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Get all files in date range
   */
  async getFilesInDateRange(
    startDate: Date,
    endDate: Date = new Date()
  ): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    const query = `modifiedTime >= '${startDate.toISOString()}' and modifiedTime <= '${endDate.toISOString()}'`;

    do {
      const drive = await this.getDriveClient();

      const response = await drive.files.list({
        q: query,
        pageSize: 100,
        pageToken,
        fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, owners)',
        orderBy: 'modifiedTime desc',
      });

      allFiles.push(...((response.data.files || []) as DriveFile[]));
      pageToken = response.data.nextPageToken || undefined;

      logger.info(`Fetched ${allFiles.length} files so far`);
    } while (pageToken);

    return allFiles;
  }
}
