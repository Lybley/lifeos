# Sentry Integration Guide for LifeOS

This guide provides complete instructions for integrating Sentry for error tracking and monitoring in both backend and frontend applications.

---

## 📋 **Prerequisites**

1. Create a Sentry account at [sentry.io](https://sentry.io)
2. Create a new project for LifeOS
3. Obtain your Sentry DSN (Data Source Name)

---

## 🔧 **Backend Integration (Node.js/Express)**

### **1. Install Sentry SDK**

```bash
cd /app/backend
yarn add @sentry/node @sentry/profiling-node
```

### **2. Configure Environment Variables**

Add to `/app/backend/.env`:

```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### **3. Initialize Sentry in Your Application**

Create `/app/backend/src/config/sentry.ts`:

```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express } from 'express';

export function initSentry(app: Express) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    
    // Performance monitoring
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    
    // Profiling
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    integrations: [
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new Sentry.Integrations.Postgres(),
    ],
    
    // Attach user context
    beforeSend(event, hint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies;
        
        // Redact authorization headers
        if (event.request.headers) {
          delete event.request.headers.authorization;
        }
      }
      
      return event;
    },
  });
  
  // RequestHandler creates a separate execution context
  app.use(Sentry.Handlers.requestHandler());
  
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());
}

export function setupSentryErrorHandler(app: Express) {
  // ErrorHandler must be registered before any other error middleware
  app.use(Sentry.Handlers.errorHandler());
}

export { Sentry };
```

### **4. Update Your Main Server File**

Update `/app/backend/src/server.ts`:

```typescript
import express from 'express';
import { initSentry, setupSentryErrorHandler, Sentry } from './config/sentry';

const app = express();

// Initialize Sentry FIRST, before other middleware
initSentry(app);

// ... your other middleware ...

// Add your routes
app.use('/api', routes);

// Setup Sentry error handler BEFORE your custom error handlers
setupSentryErrorHandler(app);

// Your custom error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(8001);
```

### **5. Capture Custom Errors**

```typescript
import { Sentry } from './config/sentry';

// Capture exception
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      feature: 'data-ingestion',
      source: 'gmail'
    },
    extra: {
      userId: user.id,
      operation: 'sync'
    }
  });
  throw error;
}

// Capture message
Sentry.captureMessage('User onboarding completed', {
  level: 'info',
  user: { id: userId, email: userEmail },
  tags: { onboarding_step: 'complete' }
});

// Set user context
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.name
});

// Add breadcrumbs
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'User logged in',
  level: 'info'
});
```

### **6. Performance Monitoring**

```typescript
import { Sentry } from './config/sentry';

// Manual transaction
const transaction = Sentry.startTransaction({
  op: 'data-ingestion',
  name: 'Gmail Sync'
});

try {
  // Create child spans
  const fetchSpan = transaction.startChild({
    op: 'fetch',
    description: 'Fetch emails from Gmail API'
  });
  
  await fetchEmails();
  fetchSpan.finish();
  
  const processSpan = transaction.startChild({
    op: 'process',
    description: 'Process and store emails'
  });
  
  await processEmails();
  processSpan.finish();
  
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  throw error;
} finally {
  transaction.finish();
}
```

---

## 🌐 **Frontend Integration (Next.js)**

### **1. Install Sentry SDK**

```bash
cd /app/frontend
yarn add @sentry/nextjs
```

### **2. Run Sentry Wizard**

```bash
npx @sentry/wizard@latest -i nextjs
```

This will create:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Update `next.config.js`

### **3. Configure Environment Variables**

Add to `/app/frontend/.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_REPLAYS_SESSION_SAMPLE_RATE=0.1
SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE=1.0
```

### **4. Client-Side Configuration**

Update `/app/frontend/sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  
  // Performance monitoring
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  
  // Session replay
  replaysSessionSampleRate: parseFloat(process.env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE || '0.1'),
  replaysOnErrorSampleRate: parseFloat(process.env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE || '1.0'),
  
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
    new Sentry.BrowserTracing({
      tracePropagationTargets: ['localhost', /^https:\/\/yourapp\.com\/api/],
    }),
  ],
  
  beforeSend(event, hint) {
    // Filter PII
    if (event.user) {
      delete event.user.email;
    }
    return event;
  },
});
```

### **5. Server-Side Configuration**

Update `/app/frontend/sentry.server.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT || 'development',
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
});
```

### **6. Capture Frontend Errors**

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';

// In your components
try {
  await fetchData();
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      component: 'ChatInterface',
      feature: 'rag-query'
    },
    user: { id: userId }
  });
  console.error(error);
}

// Set user context (after login)
Sentry.setUser({
  id: user.sub,
  email: user.email,
  username: user.name
});

// Clear user context (after logout)
Sentry.setUser(null);

// Add breadcrumb
Sentry.addBreadcrumb({
  category: 'ui.click',
  message: 'User clicked send message',
  level: 'info'
});
```

### **7. Error Boundary**

Create `/app/frontend/src/components/ErrorBoundary.tsx`:

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="error-boundary">
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

---

## 🚨 **Alert Configuration**

### **1. Set Up Alert Rules in Sentry**

Navigate to **Settings → Alerts** in Sentry dashboard:

#### **Critical Alerts**
- **Error Rate Spike**: > 100 errors in 1 minute
- **Performance Degradation**: P95 latency > 5 seconds
- **New Issue**: First occurrence of critical error

#### **Warning Alerts**
- **Error Rate Increase**: > 50 errors in 5 minutes
- **Performance Warning**: P95 latency > 3 seconds
- **High Volume**: > 1000 events in 1 hour

### **2. Integration with Slack/PagerDuty**

In Sentry dashboard:
1. Go to **Settings → Integrations**
2. Install Slack/PagerDuty integration
3. Configure alert routing per severity

---

## 📊 **Release Tracking**

### **1. Create Releases on Deployment**

Add to your CI/CD pipeline:

```bash
# Install Sentry CLI
npm install -g @sentry/cli

# Create release
export SENTRY_AUTH_TOKEN=your-auth-token
export SENTRY_ORG=your-org
export SENTRY_PROJECT=lifeos

sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli releases finalize "$VERSION"
```

### **2. Track Deployments**

```bash
sentry-cli releases deploys "$VERSION" new -e production
```

---

## 🧪 **Testing Sentry Integration**

### **Backend Test**

```typescript
// Add a test endpoint
app.get('/api/test/sentry', (req, res) => {
  throw new Error('Test error from backend');
});
```

```bash
curl http://localhost:8001/api/test/sentry
```

### **Frontend Test**

```typescript
// Add a test button
<button onClick={() => {
  throw new Error('Test error from frontend');
}}>
  Test Sentry
</button>
```

---

## 📈 **Best Practices**

### **1. Error Grouping**

Use consistent error messages and fingerprinting:

```typescript
Sentry.captureException(error, {
  fingerprint: ['data-ingestion', source, 'api-error']
});
```

### **2. Context Enrichment**

Always add relevant context:

```typescript
Sentry.setContext('action', {
  id: actionId,
  type: actionType,
  status: actionStatus
});
```

### **3. Performance Budget**

Set performance budgets in `sentry.config.ts`:

```typescript
integrations: [
  new Sentry.BrowserTracing({
    beforeNavigate: (context) => {
      return {
        ...context,
        name: window.location.pathname,
      };
    },
  }),
],
```

### **4. PII Protection**

Always scrub sensitive data:

```typescript
beforeSend(event) {
  // Remove sensitive data
  if (event.request?.data) {
    delete event.request.data.password;
    delete event.request.data.credit_card;
  }
  return event;
}
```

---

## 🎯 **Monitoring Checklist**

- [ ] Sentry installed in backend
- [ ] Sentry installed in frontend
- [ ] Environment variables configured
- [ ] Error handlers properly placed
- [ ] User context being set after login
- [ ] PII being filtered
- [ ] Alert rules configured
- [ ] Slack/PagerDuty integration set up
- [ ] Release tracking configured in CI/CD
- [ ] Test errors verified in Sentry dashboard

---

## 🔗 **Resources**

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Best Practices](https://docs.sentry.io/product/best-practices/)
