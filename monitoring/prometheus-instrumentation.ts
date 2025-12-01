/**
 * Prometheus Metrics Instrumentation for LifeOS Backend
 * 
 * This file provides complete examples for instrumenting the LifeOS backend
 * with Prometheus metrics as outlined in the monitoring architecture.
 */

import { Request, Response, NextFunction } from 'express';
import promClient from 'prom-client';

// Initialize Prometheus registry
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// ====================
// 1. HTTP REQUEST METRICS
// ====================

export const httpRequestDuration = new promClient.Histogram({
  name: 'lifeos_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const httpRequestTotal = new promClient.Counter({
  name: 'lifeos_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Middleware to track HTTP metrics
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration.observe(
      { method: req.method, route, status_code: res.statusCode },
      duration
    );
    
    httpRequestTotal.inc({ method: req.method, route, status_code: res.statusCode });
  });
  
  next();
};

// ====================
// 2. ONBOARDING METRICS
// ====================

export const onboardingStepCompleted = new promClient.Counter({
  name: 'lifeos_onboarding_step_completed_total',
  help: 'Total number of onboarding steps completed',
  labelNames: ['step', 'user_id'],
  registers: [register]
});

export const onboardingDuration = new promClient.Histogram({
  name: 'lifeos_onboarding_duration_seconds',
  help: 'Time to complete entire onboarding flow',
  labelNames: ['user_id'],
  buckets: [30, 60, 120, 300, 600, 1800], // 30s to 30min
  registers: [register]
});

// Usage example:
export function trackOnboardingStep(userId: string, step: string) {
  onboardingStepCompleted.inc({ step, user_id: userId });
}

// ====================
// 3. DATA INGESTION METRICS
// ====================

export const ingestionCounter = new promClient.Counter({
  name: 'lifeos_ingestion_total',
  help: 'Total number of data ingestion attempts',
  labelNames: ['source', 'status'],
  registers: [register]
});

export const ingestionSize = new promClient.Histogram({
  name: 'lifeos_ingestion_size_bytes',
  help: 'Size of ingested data in bytes',
  labelNames: ['source'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600], // 1KB to 100MB
  registers: [register]
});

export const ingestionDuration = new promClient.Histogram({
  name: 'lifeos_ingestion_duration_seconds',
  help: 'Duration of data ingestion operations',
  labelNames: ['source'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register]
});

// Usage example:
export async function trackIngestion(source: string, operation: () => Promise<any>) {
  const timer = ingestionDuration.startTimer({ source });
  
  try {
    const result = await operation();
    ingestionCounter.inc({ source, status: 'success' });
    
    if (result.sizeBytes) {
      ingestionSize.observe({ source }, result.sizeBytes);
    }
    
    timer();
    return result;
  } catch (error) {
    ingestionCounter.inc({ source, status: 'failure' });
    timer();
    throw error;
  }
}

// ====================
// 4. RAG QUERY METRICS
// ====================

export const ragQueryDuration = new promClient.Histogram({
  name: 'lifeos_rag_query_duration_seconds',
  help: 'Duration of RAG queries',
  labelNames: ['query_type'],
  buckets: [0.5, 1, 1.5, 2, 3, 5, 10],
  registers: [register]
});

export const vectorSearchDuration = new promClient.Histogram({
  name: 'lifeos_vector_search_duration_seconds',
  help: 'Duration of vector search operations',
  buckets: [0.1, 0.25, 0.5, 1, 2],
  registers: [register]
});

export const llmGenerationDuration = new promClient.Histogram({
  name: 'lifeos_llm_generation_duration_seconds',
  help: 'Duration of LLM generation',
  buckets: [0.5, 1, 2, 3, 5, 10],
  registers: [register]
});

export const ragQueryTotal = new promClient.Counter({
  name: 'lifeos_rag_query_total',
  help: 'Total number of RAG queries',
  labelNames: ['query_type', 'status'],
  registers: [register]
});

// Usage example:
export async function trackRagQuery(queryType: string, operation: () => Promise<any>) {
  const timer = ragQueryDuration.startTimer({ query_type: queryType });
  
  try {
    const result = await operation();
    ragQueryTotal.inc({ query_type: queryType, status: 'success' });
    timer();
    return result;
  } catch (error) {
    ragQueryTotal.inc({ query_type: queryType, status: 'failure' });
    timer();
    throw error;
  }
}

// ====================
// 5. ACTION EXECUTION METRICS
// ====================

export const actionExecution = new promClient.Counter({
  name: 'lifeos_action_execution_total',
  help: 'Total number of action executions',
  labelNames: ['action_type', 'status'],
  registers: [register]
});

export const actionExecutionDuration = new promClient.Histogram({
  name: 'lifeos_action_execution_duration_seconds',
  help: 'Duration of action execution',
  labelNames: ['action_type'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

export const actionQueueSize = new promClient.Gauge({
  name: 'lifeos_action_queue_size',
  help: 'Current size of action queue',
  registers: [register]
});

export const actionQueueWaitTime = new promClient.Histogram({
  name: 'lifeos_action_queue_wait_time_seconds',
  help: 'Time actions wait in queue before execution',
  buckets: [1, 5, 10, 30, 60, 300],
  registers: [register]
});

// Usage example:
export async function trackActionExecution(
  actionType: string, 
  operation: () => Promise<any>
) {
  const timer = actionExecutionDuration.startTimer({ action_type: actionType });
  
  try {
    const result = await operation();
    actionExecution.inc({ action_type: actionType, status: 'success' });
    timer();
    return result;
  } catch (error) {
    actionExecution.inc({ action_type: actionType, status: 'failure' });
    timer();
    throw error;
  }
}

// ====================
// 6. USER ACTIVITY METRICS
// ====================

export const userSession = new promClient.Counter({
  name: 'lifeos_user_sessions_total',
  help: 'Total number of user sessions',
  labelNames: ['user_id'],
  registers: [register]
});

export const userActions = new promClient.Counter({
  name: 'lifeos_user_actions_total',
  help: 'Total number of user actions',
  labelNames: ['user_id', 'action_type'],
  registers: [register]
});

export const sessionDuration = new promClient.Histogram({
  name: 'lifeos_session_duration_seconds',
  help: 'Duration of user sessions',
  buckets: [60, 300, 600, 1800, 3600, 7200], // 1min to 2hrs
  registers: [register]
});

export const activeUsers = new promClient.Gauge({
  name: 'lifeos_active_users',
  help: 'Number of currently active users',
  labelNames: ['period'],
  registers: [register]
});

// ====================
// 7. DATABASE METRICS
// ====================

export const dbQueryDuration = new promClient.Histogram({
  name: 'lifeos_db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

export const dbConnectionPoolSize = new promClient.Gauge({
  name: 'lifeos_db_connection_pool_size',
  help: 'Current database connection pool size',
  labelNames: ['state'], // active, idle, waiting
  registers: [register]
});

export const slowQueryCounter = new promClient.Counter({
  name: 'lifeos_db_slow_queries_total',
  help: 'Total number of slow database queries (>1s)',
  labelNames: ['operation', 'table'],
  registers: [register]
});

// ====================
// 8. CACHE METRICS
// ====================

export const cacheHitRate = new promClient.Counter({
  name: 'lifeos_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation'], // hit, miss
  registers: [register]
});

export const cacheMemoryUsage = new promClient.Gauge({
  name: 'lifeos_cache_memory_bytes',
  help: 'Current cache memory usage in bytes',
  registers: [register]
});

export const cacheEvictions = new promClient.Counter({
  name: 'lifeos_cache_evictions_total',
  help: 'Total number of cache evictions',
  registers: [register]
});

// ====================
// 9. EXTERNAL API METRICS
// ====================

export const externalApiDuration = new promClient.Histogram({
  name: 'lifeos_external_api_duration_seconds',
  help: 'Duration of external API calls',
  labelNames: ['service', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register]
});

export const externalApiErrors = new promClient.Counter({
  name: 'lifeos_external_api_errors_total',
  help: 'Total number of external API errors',
  labelNames: ['service', 'error_type'],
  registers: [register]
});

export const externalApiRateLimit = new promClient.Gauge({
  name: 'lifeos_external_api_rate_limit_remaining',
  help: 'Remaining API rate limit',
  labelNames: ['service'],
  registers: [register]
});

// ====================
// METRICS ENDPOINT
// ====================

export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

// Express route for Prometheus scraping
// Add this to your Express app:
// app.get('/metrics', async (req, res) => {
//   res.set('Content-Type', register.contentType);
//   res.end(await getMetrics());
// });
