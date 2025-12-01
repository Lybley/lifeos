'use client';

import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';
import { Citation } from './ChatMessage';

interface CitationBadgeProps {
  citation: Citation;
  onClick?: () => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, onClick }) => {
  const confidenceColor = citation.confidence
    ? citation.confidence > 0.8
      ? 'bg-green-100 text-green-800 border-green-300'
      : citation.confidence > 0.6
      ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
      : 'bg-gray-100 text-gray-800 border-gray-300'
    : 'bg-blue-100 text-blue-800 border-blue-300';

  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all hover:shadow-md ${
        confidenceColor
      }`}
      title={citation.snippet}
    >
      <FileText className="w-3 h-3" />
      <span className="max-w-[120px] truncate">{citation.title}</span>
      {citation.url && <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
      {citation.confidence && (
        <span className="ml-1 opacity-75">{Math.round(citation.confidence * 100)}%</span>
      )}
    </button>
  );
};
