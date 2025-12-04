# ============================================================================
# Voice Processor Microservice Dockerfile
# ============================================================================

FROM node:18-alpine

# Install system dependencies for audio processing
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    build-base \
    git

# Install Whisper.cpp (optional - for local processing)
WORKDIR /opt
RUN git clone https://github.com/ggerganov/whisper.cpp && \
    cd whisper.cpp && \
    make && \
    chmod +x main

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create temp directory
RUN mkdir -p /tmp/voice-processing

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start service
CMD ["node", "index.js"]
