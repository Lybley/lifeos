'use client';

import React, { useState } from 'react';
import { UploadZone } from '@/components/upload/UploadZone';
import { UploadProgress, UploadItem } from '@/components/upload/UploadProgress';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FileText, Image, File } from 'lucide-react';

export default function UploadPage() {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

  const handleUpload = async (files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      status: 'uploading',
      progress: 0,
    }));

    setUploadItems(prev => [...prev, ...newItems]);

    // Simulate upload progress for each file
    for (const item of newItems) {
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setUploadItems(prev =>
          prev.map(u =>
            u.id === item.id
              ? { ...u, progress: i, status: i === 100 ? 'completed' : 'uploading' }
              : u
          )
        );
      }
    }
  };

  const handleRetry = (id: string) => {
    setUploadItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, status: 'uploading', progress: 0, error: undefined } : item
      )
    );
  };

  const handleCancel = (id: string) => {
    setUploadItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Files</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload documents, emails, or other files to enrich your memory graph.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Upload Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadZone onUpload={handleUpload} maxSize={50} maxFiles={10} />
            </CardContent>
          </Card>

          <UploadProgress items={uploadItems} onRetry={handleRetry} onCancel={handleCancel} />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported Files</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-sm">Documents</p>
                    <p className="text-xs text-gray-500">PDF, DOCX, TXT, MD</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-sm">Images</p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF, SVG</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <File className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-sm">Other</p>
                    <p className="text-xs text-gray-500">CSV, JSON, XLSX</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-2 text-gray-600 dark:text-gray-400">
                <li>• Files are processed automatically</li>
                <li>• Text content is extracted and indexed</li>
                <li>• Entities and relationships are discovered</li>
                <li>• You can search uploaded files in chat</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
