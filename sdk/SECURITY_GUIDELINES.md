# LifeOS Plugin Security Guidelines

## Overview

This document provides comprehensive security guidelines for sandboxing third-party plugin code in the LifeOS platform. Plugin security is critical to protect user data and system integrity.

---

## 🔒 **Security Architecture**

### Multi-Layer Security Approach

1. **Container Isolation** (Primary)
2. **WASM Sandboxing** (Lightweight Alternative)
3. **RBAC & Permission System**
4. **Rate Limiting & Quotas**
5. **Runtime Monitoring**

---

## 📦 **Container-Based Sandboxing (Recommended)**

### Docker Container Isolation

**Advantages:**
- Full OS-level isolation
- Resource limits (CPU, memory, disk)
- Network isolation
- File system restrictions

### Implementation

#### 1. Plugin Container Template

```dockerfile
# Dockerfile for Plugin Sandbox
FROM node:20-alpine

# Create non-root user
RUN addgroup -S plugin && adduser -S plugin -G plugin

# Set working directory
WORKDIR /plugin

# Install security updates
RUN apk update && apk upgrade

# Copy plugin files
COPY --chown=plugin:plugin package*.json ./
RUN npm ci --only=production

COPY --chown=plugin:plugin . .

# Drop privileges
USER plugin

# Resource limits
ENV NODE_OPTIONS="--max-old-space-size=256"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start plugin
CMD ["node", "index.js"]
```

#### 2. Docker Compose Configuration

```yaml
version: '3.8'

services:
  plugin-sandbox:
    build: ./plugin
    container_name: plugin-${PLUGIN_ID}
    restart: unless-stopped
    
    # Network isolation
    networks:
      - plugin-network
    
    # Resource limits
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.25'
          memory: 128M
    
    # Security options
    security_opt:
      - no-new-privileges:true
    
    # Read-only root filesystem
    read_only: true
    
    # Temporary directories
    tmpfs:
      - /tmp:size=50M,noexec,nosuid,nodev
    
    # Environment variables
    environment:
      - PLUGIN_ID=${PLUGIN_ID}
      - LIFEOS_API_URL=http://lifeos-api:8000
      - NODE_ENV=production
    
    # No host access
    user: "1000:1000"
    
    # Logging
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  plugin-network:
    driver: bridge
    internal: false  # Only outbound to LifeOS API
```

#### 3. Kubernetes Pod Security

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: plugin-${PLUGIN_ID}
  labels:
    app: lifeos-plugin
spec:
  # Security context
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
  
  containers:
  - name: plugin
    image: registry.lifeos.io/plugin-sandbox:latest
    
    # Resource limits
    resources:
      limits:
        cpu: "500m"
        memory: "256Mi"
        ephemeral-storage: "1Gi"
      requests:
        cpu: "250m"
        memory: "128Mi"
    
    # Security context
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
    
    # Environment
    env:
    - name: PLUGIN_ID
      valueFrom:
        fieldRef:
          fieldPath: metadata.name
    
    # Volume mounts
    volumeMounts:
    - name: tmp
      mountPath: /tmp
  
  volumes:
  - name: tmp
    emptyDir:
      sizeLimit: 50Mi
  
  # Network policy
  networkPolicy:
    egress:
    - to:
      - podSelector:
          matchLabels:
            app: lifeos-api
      ports:
      - protocol: TCP
        port: 8000
```

---

## 🌐 **WASM-Based Sandboxing (Lightweight)**

### WebAssembly Isolation

**Advantages:**
- Near-native performance
- Memory-safe by design
- Portable across platforms
- Smaller footprint than containers

### Implementation

#### 1. WASM Plugin Loader

```javascript
const fs = require('fs');
const { WASI } = require('wasi');
const { Module } = require('module');

class WASMPluginSandbox {
  constructor(pluginPath, options = {}) {
    this.pluginPath = pluginPath;
    this.options = options;
    this.wasi = null;
    this.instance = null;
  }

  async load() {
    // Initialize WASI
    this.wasi = new WASI({
      args: process.argv,
      env: {
        PLUGIN_ID: this.options.pluginId,
        // Restricted environment
      },
      preopens: {
        '/tmp': '/tmp/plugin-' + this.options.pluginId,
        // No access to other directories
      },
      // Resource limits
      returnOnExit: true,
    });

    // Load WASM module
    const wasmBuffer = fs.readFileSync(this.pluginPath);
    const wasmModule = await WebAssembly.compile(wasmBuffer);
    
    // Instantiate with resource limits
    this.instance = await WebAssembly.instantiate(wasmModule, {
      wasi_snapshot_preview1: this.wasi.wasiImport,
      env: this.createSandboxedEnv(),
    });

    return this.instance;
  }

  createSandboxedEnv() {
    return {
      // Sandboxed API bindings
      lifeos_create_node: this.createNode.bind(this),
      lifeos_get_node: this.getNode.bind(this),
      lifeos_send_event: this.sendEvent.bind(this),
      
      // No access to:
      // - File system (except /tmp)
      // - Network (except LifeOS API)
      // - Process control
      // - System calls
    };
  }

  // Proxied SDK methods with validation
  async createNode(nodePtr, nodeLen) {
    const nodeData = this.readMemory(nodePtr, nodeLen);
    
    // Validate node data
    if (!this.validateNode(nodeData)) {
      throw new Error('Invalid node data');
    }
    
    // Call LifeOS API with plugin credentials
    return await this.sdk.createNode(nodeData);
  }

  validateNode(data) {
    // Check data size limits
    if (JSON.stringify(data).length > 100 * 1024) {
      return false; // Max 100KB per node
    }
    
    // Check required fields
    if (!data.type || !data.content) {
      return false;
    }
    
    return true;
  }

  readMemory(ptr, len) {
    const memory = this.instance.exports.memory;
    const buffer = new Uint8Array(memory.buffer, ptr, len);
    return JSON.parse(Buffer.from(buffer).toString('utf8'));
  }

  async execute(functionName, ...args) {
    if (!this.instance.exports[functionName]) {
      throw new Error(`Function ${functionName} not found`);
    }
    
    // Execute with timeout
    return await Promise.race([
      this.instance.exports[functionName](...args),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), 30000)
      ),
    ]);
  }

  destroy() {
    this.instance = null;
    this.wasi = null;
  }
}

module.exports = WASMPluginSandbox;
```

---

## 🔐 **RBAC & Permission System**

### Permission Model

```typescript
interface PluginPermissions {
  // Node operations
  nodes: {
    read: string[];      // Node types: ['task', 'note', 'document']
    write: string[];     // Node types plugin can write
    delete: boolean;     // Can delete nodes
  };
  
  // Relationship operations
  relationships: {
    create: boolean;
    read: boolean;
  };
  
  // Event operations
  events: {
    subscribe: string[]; // Event types: ['task-extracted', 'note-created']
    publish: string[];   // Event types plugin can publish
  };
  
  // User data access
  user: {
    profile: boolean;    // Can read user profile
    preferences: boolean; // Can read preferences
  };
  
  // Resource limits
  limits: {
    requestsPerMinute: number;  // Rate limit
    storageBytes: number;        // Max storage
    cpuTimeMs: number;           // CPU time per request
  };
}
```

### Permission Enforcement

```javascript
class PermissionManager {
  constructor(pluginId, permissions) {
    this.pluginId = pluginId;
    this.permissions = permissions;
    this.rateLimiter = new RateLimiter(permissions.limits.requestsPerMinute);
  }

  async checkNodeReadPermission(nodeType) {
    if (!this.permissions.nodes.read.includes(nodeType)) {
      throw new Error(`Plugin ${this.pluginId} not authorized to read ${nodeType} nodes`);
    }
  }

  async checkNodeWritePermission(nodeType) {
    if (!this.permissions.nodes.write.includes(nodeType)) {
      throw new Error(`Plugin ${this.pluginId} not authorized to write ${nodeType} nodes`);
    }
  }

  async checkRateLimit() {
    const allowed = await this.rateLimiter.check(this.pluginId);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for plugin ${this.pluginId}`);
    }
  }

  async checkStorageLimit(dataSize) {
    const currentUsage = await this.getStorageUsage();
    if (currentUsage + dataSize > this.permissions.limits.storageBytes) {
      throw new Error(`Storage limit exceeded for plugin ${this.pluginId}`);
    }
  }
}
```

---

## 🚨 **Runtime Monitoring**

### Plugin Monitoring Service

```javascript
class PluginMonitor {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.metrics = {
      requests: 0,
      errors: 0,
      cpuTime: 0,
      memoryUsage: 0,
      networkCalls: 0,
    };
  }

  async monitorExecution(fn) {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    try {
      this.metrics.requests++;
      const result = await fn();
      
      // Record metrics
      const endTime = process.hrtime.bigint();
      const cpuTime = Number(endTime - startTime) / 1_000_000; // Convert to ms
      this.metrics.cpuTime += cpuTime;
      
      const endMemory = process.memoryUsage();
      this.metrics.memoryUsage = endMemory.heapUsed;
      
      // Check for anomalies
      if (cpuTime > 5000) { // > 5 seconds
        this.reportAnomaly('HIGH_CPU_TIME', { cpuTime });
      }
      
      if (endMemory.heapUsed > 512 * 1024 * 1024) { // > 512MB
        this.reportAnomaly('HIGH_MEMORY_USAGE', { memory: endMemory.heapUsed });
      }
      
      return result;
    } catch (error) {
      this.metrics.errors++;
      this.reportError(error);
      throw error;
    }
  }

  reportAnomaly(type, data) {
    console.warn(`⚠️ Plugin ${this.pluginId} anomaly: ${type}`, data);
    
    // Send to monitoring service
    this.sendToMonitoring({
      type: 'plugin_anomaly',
      plugin_id: this.pluginId,
      anomaly_type: type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  reportError(error) {
    console.error(`❌ Plugin ${this.pluginId} error:`, error);
    
    // Send to monitoring service
    this.sendToMonitoring({
      type: 'plugin_error',
      plugin_id: this.pluginId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }

  async sendToMonitoring(event) {
    // Implementation depends on monitoring service
    // Could be: Prometheus, DataDog, CloudWatch, etc.
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

---

## 🛡️ **Security Best Practices**

### 1. **Input Validation**

```javascript
function validatePluginInput(data) {
  // Size limits
  const jsonString = JSON.stringify(data);
  if (jsonString.length > 1024 * 1024) { // 1MB limit
    throw new Error('Input too large');
  }
  
  // Schema validation
  const schema = {
    type: 'object',
    required: ['type', 'content'],
    properties: {
      type: { type: 'string', maxLength: 50 },
      content: { type: 'object' },
      metadata: { type: 'object' },
      tags: { type: 'array', maxItems: 10 },
    },
  };
  
  // Validate against schema
  if (!validateSchema(data, schema)) {
    throw new Error('Invalid input schema');
  }
  
  // Sanitize strings
  sanitizeObject(data);
  
  return data;
}

function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potential XSS payloads
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .slice(0, 10000); // Max string length
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}
```

### 2. **Network Isolation**

```bash
# iptables rules for plugin container
iptables -A OUTPUT -p tcp --dport 8000 -d ${LIFEOS_API_IP} -j ACCEPT
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT  # HTTPS for external APIs
iptables -A OUTPUT -j DROP  # Block all other outbound traffic
```

### 3. **Secrets Management**

```javascript
// Use encrypted secrets, never plain text
const secrets = {
  apiKey: process.env.ENCRYPTED_API_KEY,
  webhookSecret: process.env.ENCRYPTED_WEBHOOK_SECRET,
};

// Decrypt at runtime
function decryptSecret(encrypted) {
  const decipher = crypto.createDecipher('aes-256-gcm', process.env.MASTER_KEY);
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}
```

### 4. **Audit Logging**

```javascript
function logPluginAction(action, data) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    plugin_id: pluginId,
    action: action,
    data: data,
    user_id: userId,
    ip_address: req.ip,
  };
  
  // Store in immutable audit log
  auditLogger.log(auditLog);
}
```

---

## 📋 **Security Checklist**

### Before Approving a Plugin:

- [ ] Code review completed
- [ ] Dependencies audited (npm audit, snyk)
- [ ] Permissions requested are minimal
- [ ] Network access justified
- [ ] Resource limits defined
- [ ] Error handling implemented
- [ ] Logging and monitoring configured
- [ ] Security scan passed (container image)
- [ ] Test suite passed
- [ ] Documentation reviewed

### Runtime Monitoring:

- [ ] CPU usage within limits
- [ ] Memory usage within limits
- [ ] Network calls within quota
- [ ] No unauthorized API calls
- [ ] No anomalous behavior
- [ ] Error rate acceptable
- [ ] Response times normal

---

## 🚀 **Deployment Recommendations**

### Production Setup:

1. **Use Kubernetes for orchestration**
   - Pod security policies
   - Network policies
   - Resource quotas

2. **Implement WAF (Web Application Firewall)**
   - Rate limiting
   - DDoS protection
   - Input validation

3. **Use secrets management**
   - Vault, AWS Secrets Manager, or Azure Key Vault
   - Rotate secrets regularly

4. **Enable comprehensive logging**
   - Centralized logging (ELK, Splunk)
   - Security alerts
   - Anomaly detection

5. **Regular security updates**
   - Automated dependency updates
   - Container image scanning
   - Vulnerability patching

---

## 📚 **Additional Resources**

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [Kubernetes Pod Security Standards](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [WASM Security Considerations](https://webassembly.org/docs/security/)
- [NIST Container Security Guide](https://www.nist.gov/publications/application-container-security-guide)

---

## 🆘 **Incident Response**

### If a Security Issue is Detected:

1. **Immediately disable the plugin**
2. **Isolate affected systems**
3. **Review audit logs**
4. **Notify affected users**
5. **Patch vulnerability**
6. **Conduct post-mortem**
7. **Update security policies**

---

**Version:** 1.0.0  
**Last Updated:** 2025-12-01  
**Maintained by:** LifeOS Security Team
