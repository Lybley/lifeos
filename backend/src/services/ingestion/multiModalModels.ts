/**
 * Multi-Modal Ingestion Data Models
 * 
 * Supports voice, image, screenshot, and browser history ingestion
 */

// ============================================================================
// BASE INGESTION MODEL
// ============================================================================

export enum IngestionType {
  VOICE_MESSAGE = 'voice_message',
  IMAGE = 'image',
  SCREENSHOT = 'screenshot',
  BROWSER_HISTORY = 'browser_history',
  TEXT = 'text',
  VIDEO = 'video',
}

export interface BaseIngestion {
  id: string;
  userId: string;
  type: IngestionType;
  
  // Source metadata
  source: string; // 'mobile_app', 'chrome_extension', 'api', etc.
  sourceId?: string;
  
  // Temporal
  capturedAt: Date;
  processedAt?: Date;
  
  // Content
  rawContent: string | Buffer;
  processedContent?: ProcessedContent;
  
  // Storage
  storageUrl?: string; // S3/GCS URL
  thumbnailUrl?: string;
  
  // Processing status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  
  // Metadata
  metadata: Record<string, any>;
  tags: string[];
}

export interface ProcessedContent {
  text?: string;
  embeddings?: number[];
  entities?: ExtractedEntity[];
  summary?: string;
  language?: string;
  confidence?: number;
}

export interface ExtractedEntity {
  type: 'person' | 'organization' | 'location' | 'date' | 'url' | 'email' | 'phone' | 'product';
  value: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
}

// ============================================================================
// VOICE MESSAGE MODEL
// ============================================================================

export interface VoiceMessage extends BaseIngestion {
  type: IngestionType.VOICE_MESSAGE;
  
  // Audio properties
  audioMetadata: {
    duration: number; // seconds
    format: 'mp3' | 'wav' | 'ogg' | 'webm' | 'm4a';
    sampleRate: number;
    channels: number;
    bitrate: number;
    size: number; // bytes
  };
  
  // Transcription
  transcription?: {
    text: string;
    language: string;
    confidence: number;
    words?: TranscribedWord[];
  };
  
  // Speaker identification
  speaker?: {
    id: string;
    name?: string;
    confidence: number;
  };
  
  // Audio analysis
  audioAnalysis?: {
    volume: number; // 0-1
    tempo: number; // BPM
    emotion?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
    backgroundNoise: number; // 0-1
  };
}

export interface TranscribedWord {
  word: string;
  start: number; // seconds
  end: number;
  confidence: number;
}

// ============================================================================
// IMAGE MODEL
// ============================================================================

export interface ImageIngestion extends BaseIngestion {
  type: IngestionType.IMAGE;
  
  // Image properties
  imageMetadata: {
    width: number;
    height: number;
    format: 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp';
    size: number; // bytes
    exif?: Record<string, any>;
  };
  
  // Vision analysis
  visionAnalysis?: {
    caption: string;
    captionConfidence: number;
    sceneDescription: string;
    objects: DetectedObject[];
    faces: DetectedFace[];
    text: OCRResult[];
    colors: DominantColor[];
    labels: Label[];
  };
  
  // Classification
  classification?: {
    category: string;
    subcategory?: string;
    confidence: number;
    tags: string[];
  };
}

export interface DetectedObject {
  name: string;
  confidence: number;
  boundingBox: BoundingBox;
}

export interface DetectedFace {
  confidence: number;
  boundingBox: BoundingBox;
  attributes?: {
    age?: number;
    gender?: string;
    emotion?: string;
    glasses?: boolean;
  };
}

export interface OCRResult {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  language?: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DominantColor {
  rgb: [number, number, number];
  hex: string;
  percentage: number;
  name?: string;
}

export interface Label {
  name: string;
  confidence: number;
  parents?: string[];
}

// ============================================================================
// SCREENSHOT MODEL
// ============================================================================

export interface ScreenshotIngestion extends BaseIngestion {
  type: IngestionType.SCREENSHOT;
  
  // Screenshot properties
  screenshotMetadata: {
    width: number;
    height: number;
    format: 'png' | 'jpeg';
    size: number;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    application?: string; // App that was captured
  };
  
  // OCR results
  ocrResults?: {
    fullText: string;
    confidence: number;
    blocks: TextBlock[];
    language: string;
  };
  
  // Screenshot classification
  classification?: {
    type: 'document' | 'webpage' | 'chat' | 'code' | 'email' | 'social' | 'other';
    confidence: number;
    application?: string;
  };
  
  // Content chunks
  chunks?: ContentChunk[];
  
  // UI elements detected
  uiElements?: UIElement[];
}

export interface TextBlock {
  text: string;
  confidence: number;
  boundingBox: BoundingBox;
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'table';
}

export interface ContentChunk {
  id: string;
  text: string;
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'table' | 'mixed';
  position: number;
  boundingBox?: BoundingBox;
  embeddings?: number[];
}

export interface UIElement {
  type: 'button' | 'input' | 'link' | 'image' | 'menu' | 'icon';
  text?: string;
  boundingBox: BoundingBox;
  confidence: number;
}

// ============================================================================
// BROWSER HISTORY MODEL
// ============================================================================

export interface BrowserHistoryIngestion extends BaseIngestion {
  type: IngestionType.BROWSER_HISTORY;
  
  // Browser info
  browserMetadata: {
    browser: 'chrome' | 'firefox' | 'safari' | 'edge';
    version: string;
    os: string;
    extensionVersion: string;
  };
  
  // History entries
  entries: BrowserHistoryEntry[];
  
  // Aggregated insights
  insights?: {
    totalVisits: number;
    uniqueDomains: number;
    topDomains: DomainStat[];
    categories: CategoryStat[];
    timeDistribution: TimeDistribution[];
  };
}

export interface BrowserHistoryEntry {
  id: string;
  url: string;
  title: string;
  visitTime: Date;
  visitCount: number;
  
  // Derived data
  domain: string;
  path: string;
  category?: string;
  tags?: string[];
  
  // Content
  pageContent?: {
    text: string;
    summary: string;
    entities: ExtractedEntity[];
    sentiment?: number;
  };
  
  // User interaction
  duration?: number; // seconds on page
  scrollDepth?: number; // 0-1
  interactions?: number; // clicks, etc.
}

export interface DomainStat {
  domain: string;
  count: number;
  totalDuration: number;
  category: string;
}

export interface CategoryStat {
  category: string;
  count: number;
  percentage: number;
}

export interface TimeDistribution {
  hour: number;
  count: number;
}

// ============================================================================
// INGESTION PIPELINE CONFIG
// ============================================================================

export interface IngestionConfig {
  // Voice processing
  voice: {
    whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language?: string;
    enableSpeakerDiarization: boolean;
    enableEmotionDetection: boolean;
  };
  
  // Image processing
  image: {
    maxSize: number; // MB
    generateThumbnail: boolean;
    thumbnailSize: number; // pixels
    enableOCR: boolean;
    enableCaptioning: boolean;
    enableObjectDetection: boolean;
    visionProvider: 'openai' | 'google' | 'local';
  };
  
  // Screenshot processing
  screenshot: {
    enableOCR: boolean;
    enableClassification: boolean;
    chunkSize: number; // characters
    chunkOverlap: number;
    enableUIDetection: boolean;
  };
  
  // Browser history
  browserHistory: {
    maxEntriesPerBatch: number;
    enableContentFetch: boolean;
    enableCategorization: boolean;
    privacyMode: boolean; // Filter sensitive URLs
  };
  
  // Storage
  storage: {
    provider: 's3' | 'gcs' | 'local';
    bucket?: string;
    retentionDays: number;
  };
  
  // Processing
  processing: {
    generateEmbeddings: boolean;
    embeddingModel: string;
    extractEntities: boolean;
    generateSummary: boolean;
  };
}

export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
  voice: {
    whisperModel: 'base',
    enableSpeakerDiarization: false,
    enableEmotionDetection: true,
  },
  image: {
    maxSize: 10,
    generateThumbnail: true,
    thumbnailSize: 256,
    enableOCR: true,
    enableCaptioning: true,
    enableObjectDetection: true,
    visionProvider: 'openai',
  },
  screenshot: {
    enableOCR: true,
    enableClassification: true,
    chunkSize: 500,
    chunkOverlap: 50,
    enableUIDetection: false,
  },
  browserHistory: {
    maxEntriesPerBatch: 100,
    enableContentFetch: false,
    enableCategorization: true,
    privacyMode: true,
  },
  storage: {
    provider: 'local',
    retentionDays: 90,
  },
  processing: {
    generateEmbeddings: true,
    embeddingModel: 'text-embedding-3-small',
    extractEntities: true,
    generateSummary: true,
  },
};

// ============================================================================
// PROCESSING QUEUE JOBS
// ============================================================================

export interface IngestionJob {
  jobId: string;
  type: IngestionType;
  ingestionId: string;
  userId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: Date;
  attempts: number;
  maxAttempts: number;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  error?: string;
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export type AnyIngestion = 
  | VoiceMessage 
  | ImageIngestion 
  | ScreenshotIngestion 
  | BrowserHistoryIngestion;
