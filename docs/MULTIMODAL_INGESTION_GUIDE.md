# Multi-Modal Ingestion Pipeline

## Overview

Comprehensive ingestion system supporting voice, image, screenshot, and browser history with AI-powered processing.

## Supported Modalities

### 1. Voice Messages (Whisper-based)
- **Formats**: MP3, WAV, OGG, WebM, M4A
- **Processing**: 
  - Speech-to-text via Whisper (OpenAI API or local whisper.cpp)
  - Word-level timestamps
  - Emotion detection
  - Speaker identification (optional)
- **Node Type**: VoiceMessage
- **Endpoint**: `POST /api/v1/ingest/voice`

### 2. Images
- **Formats**: JPEG, PNG, GIF, WebP, BMP
- **Processing**:
  - Image captioning (OpenAI Vision / Google Cloud Vision)
  - OCR (Tesseract)
  - Object detection
  - Scene description
  - Face detection
  - Dominant color extraction
- **Node Type**: ImageIngestion
- **Endpoint**: `POST /api/v1/ingest/image`

### 3. Screenshots
- **Formats**: PNG, JPEG
- **Processing**:
  - OCR with block detection
  - Content type classification (document/webpage/chat/code/email)
  - Semantic chunking with overlap
  - UI element detection (optional)
- **Node Type**: ScreenshotIngestion
- **Endpoint**: `POST /api/v1/ingest/screenshot`

### 4. Browser History
- **Source**: Chrome Extension
- **Processing**:
  - URL parsing
  - Domain categorization
  - Visit frequency analysis
  - Privacy filtering
- **Node Type**: BrowserHistoryIngestion
- **Endpoint**: `POST /api/v1/ingest/browser`

## Chrome Extension

### Installation
1. Load unpacked extension from `/app/chrome-extension`
2. Grant history permission
3. Configure API endpoint and credentials in options

### Features
- **Auto-sync**: Hourly background sync
- **Privacy Mode**: Filters banking, login, private URLs
- **Manual Sync**: On-demand sync via popup
- **Batch Processing**: 100 entries per batch
- **Status Monitoring**: Real-time sync status

### Security
- API key authentication
- User consent required
- No sensitive URL capture
- Encrypted transmission

## Microservices Architecture

### Voice Processor Service
- **Port**: 3001
- **Dependencies**: FFmpeg, Whisper
- **Resources**: 2GB RAM, 2 CPU cores
- **Processing Time**: ~5s per minute of audio

### Image Processor Service
- **Port**: 3002
- **Dependencies**: Sharp, Tesseract, Vision API
- **Resources**: 3GB RAM, 2 CPU cores
- **Processing Time**: ~3s per image

### Screenshot Processor Service
- **Port**: 3003
- **Dependencies**: Tesseract, Sharp
- **Resources**: 3GB RAM, 2 CPU cores
- **Processing Time**: ~2s per screenshot

### Browser Processor Service
- **Port**: 3004
- **Dependencies**: None
- **Resources**: 2GB RAM, 1 CPU core
- **Processing Time**: ~100ms per entry

## API Endpoints

### Voice Ingestion
```bash
curl -X POST http://localhost:8000/api/v1/ingest/voice \
  -H "X-User-Id: user_123" \
  -F "audio=@voice_note.mp3" \
  -F "source=mobile_app"
```

**Response:**
```json
{
  "success": true,
  "ingestionId": "voice_abc123",
  "transcription": "Hello, this is a test message...",
  "language": "en",
  "duration": 45.2
}
```

### Image Ingestion
```bash
curl -X POST http://localhost:8000/api/v1/ingest/image \
  -H "X-User-Id: user_123" \
  -F "image=@photo.jpg" \
  -F "source=camera"
```

**Response:**
```json
{
  "success": true,
  "ingestionId": "img_abc123",
  "caption": "A person sitting at a desk with a laptop",
  "objects": ["person", "laptop", "desk", "chair"],
  "text": ["Welcome to the meeting"],
  "classification": {
    "category": "people",
    "subcategory": "portrait",
    "confidence": 0.85
  }
}
```

### Screenshot Ingestion
```bash
curl -X POST http://localhost:8000/api/v1/ingest/screenshot \
  -H "X-User-Id: user_123" \
  -F "screenshot=@screen.png" \
  -F "device_type=desktop" \
  -F "application=VSCode"
```

**Response:**
```json
{
  "success": true,
  "ingestionId": "scr_abc123",
  "textExtracted": 1247,
  "classification": {
    "type": "code",
    "confidence": 0.9,
    "application": "VSCode"
  },
  "chunks": 3
}
```

### Browser History Ingestion
```bash
curl -X POST http://localhost:8000/api/v1/ingest/browser \
  -H "Authorization: Bearer <extension_api_key>" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "entries": [...],
    "browserMetadata": {
      "browser": "chrome",
      "version": "120.0",
      "os": "mac",
      "extensionVersion": "1.0.0"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "ingestionId": "hist_abc123",
  "entriesProcessed": 87,
  "uniqueDomains": 23
}
```

## Database Schema

### Ingestions Table (PostgreSQL)
```sql
CREATE TABLE ingestions (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  source VARCHAR(100),
  captured_at TIMESTAMP,
  processed_at TIMESTAMP,
  status VARCHAR(20),
  raw_content TEXT,
  processed_content JSONB,
  metadata JSONB,
  tags TEXT[],
  error TEXT
);
```

## Docker Deployment

### Start All Services
```bash
docker-compose -f docker-compose.multimodal.yml up -d
```

### Scale Individual Services
```bash
docker-compose -f docker-compose.multimodal.yml up -d --scale voice-processor=3
```

### View Logs
```bash
docker-compose -f docker-compose.multimodal.yml logs -f voice-processor
```

### Health Checks
```bash
curl http://localhost:8000/health
```

## Configuration

### Environment Variables
```bash
# API Keys
OPENAI_API_KEY=sk-...
GOOGLE_CLOUD_API_KEY=AIza...

# Database
POSTGRES_PASSWORD=secure_password

# Processing Options
WHISPER_MODEL=base  # tiny, base, small, medium, large
VISION_PROVIDER=openai  # openai, google, local
OCR_ENGINE=tesseract
```

## Performance Benchmarks

| Modality | Avg Processing Time | Resources | Throughput |
|----------|---------------------|-----------|------------|
| Voice (1 min) | 5s | 2GB RAM, 2 CPU | 12/min |
| Image | 3s | 3GB RAM, 2 CPU | 20/min |
| Screenshot | 2s | 3GB RAM, 2 CPU | 30/min |
| Browser Entry | 100ms | 2GB RAM, 1 CPU | 600/min |

## Extension Features

### Popup Interface
- Real-time sync status
- Manual sync trigger
- Auto-sync toggle
- Last sync timestamp
- Items synced count

### Options Page
- API endpoint configuration
- User ID and API key
- Privacy settings
- Sync frequency
- URL filters

### Privacy Controls
- Whitelist/blacklist domains
- Filter sensitive patterns
- Incognito mode exclusion
- Manual approval mode

## Testing

### Unit Tests
```bash
npm test services/voice-processor
npm test services/image-processor
npm test services/screenshot-processor
```

### Integration Tests
```bash
npm run test:integration
```

### Extension Testing
1. Load extension in developer mode
2. Open popup
3. Click "Sync Now"
4. Check console for logs
5. Verify data in backend

## Monitoring

### Metrics
- Ingestion rate (items/min)
- Processing time (p50, p95, p99)
- Error rate (%)
- Queue depth
- Resource utilization

### Alerts
- Processing time > 10s
- Error rate > 5%
- Queue depth > 1000
- Disk usage > 80%

## Troubleshooting

### Voice Processing Fails
- Check FFmpeg installation
- Verify Whisper model downloaded
- Check audio format supported
- Increase memory allocation

### Image Processing Fails
- Verify Vision API key
- Check image format and size
- Increase timeout
- Try local processing

### Extension Not Syncing
- Check permissions granted
- Verify API endpoint reachable
- Check API key valid
- View background service logs

## Future Enhancements

1. **Video Processing**: Frame extraction + transcription
2. **PDF Ingestion**: Text extraction + layout analysis
3. **Email Parsing**: Full email thread analysis
4. **Calendar Events**: Event extraction and linking
5. **Real-time Streaming**: Live audio/video ingestion
