# LifeOS Monitoring & Observability Architecture

## Overview

This document outlines the complete monitoring and observability strategy for LifeOS, covering metrics, logs, errors, and distributed tracing.

---

## 🎯 **Monitoring Stack**

### **Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                     LifeOS Platform                      │
├─────────────────────────────────────────────────────────┤
│  Backend APIs    │   Frontend    │   Connectors         │
│  (Metrics +      │   (RUM +      │   (Metrics +         │
│   Logs +         │   Errors)     │   Logs)              │
│   Traces)        │               │                      │
└──────────┬───────────────┬───────────────┬─────────────┘
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐   ┌──────────┐
    │Prometheus│    │  Sentry  │   │Filebeat/ │
    │  Metrics │    │  Errors  │   │Fluentd   │
    └─────┬────┘    └─────┬────┘   └─────┬────┘
          │               │              │
          ▼               ▼              ▼
    ┌──────────┐    ┌──────────┐   ┌──────────┐
    │ Grafana  │    │ Sentry   │   │Elasticsearch│
    │Dashboards│    │Dashboard │   │  + Kibana│
    └──────────┘    └──────────┘   └──────────┘
          │                              │
          └──────────┬───────────────────┘
                     ▼
              ┌──────────────┐
              │  AlertManager│
              │   + PagerDuty│
              └──────────────┘
```

---

## 📊 **Key Performance Indicators (KPIs)**

### 1. **User Onboarding Completion Rate**

**Definition:** Percentage of users who complete the onboarding flow

**Formula:** `(Users who completed onboarding / Total signups) × 100`

**Target:** > 80%

**Tracking:**
```javascript
// Metric name: lifeos_onboarding_step_completed_total
// Labels: step (welcome, connect_accounts, privacy_setup, tutorial, complete)

// Counter increment on each step
onboardingStepCompleted.inc({ step: 'privacy_setup', user_id: userId });

// Time to complete
onboardingDuration.observe({ user_id: userId }, durationSeconds);
```

**Alert Thresholds:**
- Critical: < 60% (24h window)
- Warning: < 70% (24h window)

---

### 2. **Data Ingestion Success Rate**

**Definition:** Percentage of data ingestion jobs that complete successfully

**Formula:** `(Successful ingestions / Total ingestion attempts) × 100`

**Target:** > 99%

**Tracking:**
```javascript
// Metric name: lifeos_ingestion_total
// Labels: source (gmail, drive, calendar), status (success, failure, partial)

ingestionCounter.inc({ source: 'gmail', status: 'success' });

// Track ingestion size and duration
ingestionSize.observe({ source: 'gmail' }, sizeBytes);
ingestionDuration.observe({ source: 'gmail' }, durationSeconds);
```

**Alert Thresholds:**
- Critical: < 95% (1h window)
- Warning: < 98% (1h window)

---

### 3. **RAG Response Latency**

**Definition:** Time taken to generate RAG-powered responses

**Targets:**
- P50: < 1.5 seconds
- P95: < 3.0 seconds
- P99: < 5.0 seconds

**Tracking:**
```javascript
// Metric name: lifeos_rag_query_duration_seconds
// Labels: query_type (chat, search, summarize)

const timer = ragQueryDuration.startTimer({ query_type: 'chat' });
// ... execute RAG query ...
timer();

// Track component latencies
vectorSearchDuration.observe(duration);
llmGenerationDuration.observe(duration);
rerankingDuration.observe(duration);
```

**Alert Thresholds:**
- Critical: P95 > 5s (5min window)
- Warning: P95 > 3.5s (5min window)

---

### 4. **Hallucination Rate**

**Definition:** Percentage of RAG responses that contain hallucinations (manual evaluation)

**Formula:** `(Hallucinated responses / Total evaluated responses) × 100`

**Target:** < 5%

**Tracking:**
```javascript
// Manual evaluation system
// Metric name: lifeos_rag_hallucination_rate
// Labels: evaluator (human, automated), severity (low, medium, high)

hallucinations.inc({ 
  evaluator: 'human', 
  severity: 'medium',
  query_type: 'factual'
});

// Track evaluation metadata
evaluationMetadata.set({
  response_id: responseId,
  has_citations: true,
  citation_accuracy: 0.95
});
```

**Process:**
- Sample 100 responses daily
- Human evaluation by content team
- Automated checks for citation accuracy
- A/B testing for prompt improvements

**Alert Thresholds:**
- Critical: > 10% (weekly evaluation)
- Warning: > 7% (weekly evaluation)

---

### 5. **Action Execution Success Rate**

**Definition:** Percentage of user actions that execute successfully

**Formula:** `(Successful actions / Total actions attempted) × 100`

**Target:** > 98%

**Tracking:**
```javascript
// Metric name: lifeos_action_execution_total
// Labels: action_type, status (success, failure, timeout, rejected)

actionExecution.inc({ 
  action_type: 'send_email', 
  status: 'success' 
});

// Track execution time
actionExecutionDuration.observe({ action_type: 'send_email' }, duration);

// Track queue metrics
actionQueueSize.set(queueLength);
actionQueueWaitTime.observe(waitTimeSeconds);
```

**Alert Thresholds:**
- Critical: < 95% (1h window)
- Warning: < 97% (1h window)

---

### 6. **Daily Active Users (DAU) / Weekly Active Users (WAU)**

**Definition:** Number of unique users active in 24h / 7 days

**Tracking:**
```javascript
// Metric name: lifeos_active_users
// Labels: period (daily, weekly, monthly)

// Track user sessions
userSession.inc({ user_id: userId });

// Track engagement metrics
userActions.inc({ user_id: userId, action_type: 'chat_query' });
sessionDuration.observe({ user_id: userId }, durationSeconds);

// Calculate DAU/WAU ratio
// DAU/WAU > 0.2 indicates good stickiness
```

**Target Ratios:**
- DAU/MAU: > 0.15 (daily engagement)
- DAU/WAU: > 0.25 (weekly stickiness)

**Alert Thresholds:**
- Critical: 20% drop week-over-week
- Warning: 10% drop week-over-week

---

## 🔧 **Additional Technical Metrics**

### **System Health**
- CPU utilization (per service)
- Memory usage (per service)
- Disk I/O (per node)
- Network throughput

### **Database**
- Query latency (P50, P95, P99)
- Connection pool utilization
- Slow query count (> 1s)
- Replication lag

### **Cache**
- Redis hit/miss rate
- Cache memory usage
- Eviction rate

### **External APIs**
- Third-party API latency (Auth0, Pinecone, OpenAI)
- API error rates
- Rate limit approaching threshold

---

## 🚨 **Alerting Strategy**

### **Severity Levels**

**Critical (P1):**
- Service completely down
- Data loss risk
- Security breach
- KPI failure > 50% from target

**High (P2):**
- Degraded performance
- Partial service outage
- KPI failure 25-50% from target

**Medium (P3):**
- Performance degradation
- Non-critical feature down
- KPI failure 10-25% from target

**Low (P4):**
- Minor issues
- Warning thresholds breached
- Informational alerts

### **Alert Routing**

```yaml
Critical:
  - PagerDuty (immediate)
  - Slack #incidents
  - SMS to on-call engineer

High:
  - Slack #alerts
  - Email to on-call

Medium:
  - Slack #monitoring
  - Email to team

Low:
  - Slack #monitoring (batched)
```

---

## 📈 **Dashboards**

### **Executive Dashboard**
- DAU/WAU trend
- Onboarding completion rate
- System uptime
- Revenue metrics

### **Engineering Dashboard**
- Service health (all services)
- Error rates
- Latency percentiles
- Database performance

### **Product Dashboard**
- Feature usage
- User engagement
- RAG query success rate
- Action execution metrics

### **On-Call Dashboard**
- Active incidents
- Recent deployments
- Error spike detection
- Capacity metrics

---

## 🔍 **Distributed Tracing**

### **OpenTelemetry Integration**

Track request flow across services:
1. User request → Frontend
2. Frontend → Backend API
3. Backend → Database query
4. Backend → External API (OpenAI)
5. Backend → Response

**Trace Attributes:**
- Request ID
- User ID
- Session ID
- Feature flag state
- A/B test variant

---

## 📝 **Log Aggregation**

### **Log Levels**

```javascript
ERROR   - System errors, exceptions
WARN    - Degraded performance, retries
INFO    - Important business events
DEBUG   - Detailed diagnostic info
TRACE   - Fine-grained debug info
```

### **Structured Logging**

```json
{
  "timestamp": "2025-12-01T12:00:00Z",
  "level": "INFO",
  "service": "backend",
  "trace_id": "abc123",
  "user_id": "user_456",
  "event": "rag_query_completed",
  "duration_ms": 1234,
  "metadata": {
    "query_type": "chat",
    "tokens_used": 1500,
    "citations_found": 3
  }
}
```

---

## 🎯 **Success Metrics**

### **Monitoring Coverage**
- [ ] 100% of critical endpoints instrumented
- [ ] All user-facing features tracked
- [ ] All external API calls monitored
- [ ] All database queries measured

### **Alert Quality**
- < 5% false positive rate
- > 95% alert response time < 5 minutes
- 100% critical alerts acknowledged

### **Dashboard Adoption**
- 100% of engineers check dashboards daily
- Executive dashboard reviewed weekly
- Product dashboard drives feature decisions

---

## 🔄 **Continuous Improvement**

### **Weekly Review**
- Review alert fatigue
- Adjust thresholds
- Add new metrics for new features

### **Monthly Review**
- Dashboard effectiveness
- KPI achievement
- Capacity planning

### **Quarterly Review**
- Monitoring strategy alignment
- Tool evaluation
- Cost optimization

---

## 📚 **References**

- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
- [Grafana Dashboard Design](https://grafana.com/docs/grafana/latest/dashboards/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
