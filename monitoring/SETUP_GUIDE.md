# LifeOS Monitoring Setup Guide

This guide walks you through setting up the complete monitoring and observability stack for LifeOS.

---

## 📋 **Overview**

The LifeOS monitoring stack consists of:

1. **Prometheus** - Metrics collection and storage
2. **Grafana** - Metrics visualization and dashboards
3. **Alertmanager** - Alert routing and notification
4. **Sentry** - Error tracking and performance monitoring
5. **ELK Stack** (Optional) - Log aggregation and analysis

---

## 🚀 **Quick Start (Development)**

### Step 1: Add Metrics Endpoint to Backend

Install Prometheus client:

```bash
cd /app/backend
yarn add prom-client
```

Copy the instrumentation code:

```bash
cp /app/monitoring/prometheus-instrumentation.ts /app/backend/src/config/
```

Update your `server.ts`:

```typescript
import express from 'express';
import { metricsMiddleware, getMetrics } from './config/prometheus-instrumentation';

const app = express();

// Add metrics middleware
app.use(metricsMiddleware);

// Add metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.end(await getMetrics());
});

// ... rest of your app setup ...
```

### Step 2: Test Metrics Endpoint

```bash
# Restart backend
cd /app/backend
yarn dev

# Check metrics
curl http://localhost:8001/metrics
```

You should see Prometheus metrics output.

### Step 3: Run Prometheus Locally (Optional for Testing)

Create `prometheus.yml`:

```yaml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

scrape_configs:
  - job_name: 'lifeos-backend'
    static_configs:
      - targets: ['localhost:8001']
```

Run Prometheus:

```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

Visit http://localhost:9090 to view Prometheus.

### Step 4: Run Grafana Locally (Optional for Testing)

```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

Visit http://localhost:3000 (admin/admin) and:
1. Add Prometheus datasource (http://host.docker.internal:9090)
2. Import dashboard from `/app/monitoring/grafana-dashboard.json`

---

## 🏗️ **Production Setup (Kubernetes)**

### Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Helm 3.x installed
- LifeOS already deployed to cluster

### Step 1: Install Prometheus Operator

```bash
# Add Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create monitoring namespace
kubectl create namespace monitoring

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.adminPassword=changeme123
```

**Important**: Change the Grafana password!

### Step 2: Expose Metrics in Backend Deployment

Update `/app/k8s/backend-service.yaml` to expose metrics port:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: lifeos-backend
  namespace: lifeos
  labels:
    app: lifeos-backend
spec:
  selector:
    app: lifeos-backend
  ports:
    - name: http
      port: 8001
      targetPort: 8001
      protocol: TCP
  type: ClusterIP
```

### Step 3: Create ServiceMonitor

```bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: lifeos-backend
  namespace: lifeos
  labels:
    app: lifeos-backend
spec:
  selector:
    matchLabels:
      app: lifeos-backend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
EOF
```

### Step 4: Verify Metrics Collection

```bash
# Port-forward Prometheus
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring

# Visit http://localhost:9090/targets
# You should see lifeos-backend target
```

### Step 5: Import Grafana Dashboard

```bash
# Get Grafana password
kubectl get secret prometheus-grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode

# Port-forward Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring

# Visit http://localhost:3000
# Login: admin / <password from above>
```

In Grafana:
1. Go to **Dashboards** → **Import**
2. Upload `/app/monitoring/grafana-dashboard.json`
3. Select **Prometheus** as datasource
4. Click **Import**

### Step 6: Configure Alerts

```bash
kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: lifeos-alerts
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
    role: alert-rules
spec:
  groups:
  - name: lifeos.rules
    interval: 30s
    rules:
    - alert: LifeOSBackendDown
      expr: up{job="lifeos-backend"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "LifeOS Backend is down"
        description: "Backend has been down for more than 2 minutes"
    
    - alert: HighErrorRate
      expr: rate(lifeos_http_requests_total{status_code=~"5.."}[5m]) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ \$value }} requests/sec"
    
    - alert: HighRAGLatency
      expr: histogram_quantile(0.95, rate(lifeos_rag_query_duration_seconds_bucket[5m])) > 5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High RAG query latency"
        description: "P95 latency is {{ \$value }}s"
EOF
```

### Step 7: Configure Alertmanager (Slack Integration)

First, create a Slack webhook:
1. Go to https://api.slack.com/messaging/webhooks
2. Create a new webhook for your workspace
3. Copy the webhook URL

Update Alertmanager config:

```bash
kubectl create secret generic alertmanager-prometheus-kube-prometheus-alertmanager \
  --from-literal=alertmanager.yaml="$(cat <<EOF
global:
  resolve_timeout: 5m
  slack_api_url: 'YOUR_SLACK_WEBHOOK_URL'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 12h
  routes:
  - match:
      severity: critical
    receiver: 'critical'
  - match:
      severity: warning
    receiver: 'warning'

receivers:
- name: 'default'
  slack_configs:
  - channel: '#monitoring'
    title: 'LifeOS Alert'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

- name: 'critical'
  slack_configs:
  - channel: '#incidents'
    title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    send_resolved: true

- name: 'warning'
  slack_configs:
  - channel: '#alerts'
    title: '⚠️  WARNING: {{ .GroupLabels.alertname }}'
    text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    send_resolved: true
EOF
)" \
  --namespace monitoring \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart Alertmanager
kubectl rollout restart statefulset/alertmanager-prometheus-kube-prometheus-alertmanager -n monitoring
```

---

## 🐛 **Sentry Setup**

### Step 1: Create Sentry Account

1. Go to https://sentry.io/signup/
2. Create a new organization
3. Create a project named "LifeOS Backend"
4. Copy the DSN (Data Source Name)

### Step 2: Install Sentry in Backend

```bash
cd /app/backend
yarn add @sentry/node @sentry/profiling-node
```

Copy Sentry config:

```bash
cp /app/monitoring/SENTRY_INTEGRATION.md /app/docs/
```

Create `/app/backend/src/config/sentry.ts` (see SENTRY_INTEGRATION.md for full code).

Update `.env`:

```env
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Step 3: Initialize Sentry in Your App

Update `server.ts`:

```typescript
import { initSentry, setupSentryErrorHandler } from './config/sentry';

const app = express();

// Initialize Sentry FIRST
initSentry(app);

// ... your middleware and routes ...

// Setup error handler BEFORE custom error handlers
setupSentryErrorHandler(app);
```

### Step 4: Install Sentry in Frontend

```bash
cd /app/frontend
yarn add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Update `.env.local`:

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
```

### Step 5: Test Sentry

Backend test:

```bash
curl http://localhost:8001/api/test/sentry
```

Frontend test: Add a test button that throws an error.

Check Sentry dashboard for the errors.

---

## 📊 **Custom Metrics Examples**

### Track Onboarding Steps

```typescript
import { trackOnboardingStep } from './config/prometheus-instrumentation';

app.post('/api/onboarding/complete-step', async (req, res) => {
  const { userId, step } = req.body;
  
  // Track in Prometheus
  trackOnboardingStep(userId, step);
  
  // Your business logic...
  
  res.json({ success: true });
});
```

### Track Data Ingestion

```typescript
import { trackIngestion } from './config/prometheus-instrumentation';

async function syncGmailData(userId: string) {
  return await trackIngestion('gmail', async () => {
    const emails = await fetchEmailsFromGmail(userId);
    await storeEmails(emails);
    
    return {
      sizeBytes: calculateSize(emails)
    };
  });
}
```

### Track RAG Queries

```typescript
import { trackRagQuery } from './config/prometheus-instrumentation';

app.post('/api/chat', async (req, res) => {
  const { query } = req.body;
  
  const response = await trackRagQuery('chat', async () => {
    return await ragService.query(query);
  });
  
  res.json(response);
});
```

### Track Action Execution

```typescript
import { trackActionExecution } from './config/prometheus-instrumentation';

async function executeAction(action: Action) {
  return await trackActionExecution(action.type, async () => {
    return await actionEngine.execute(action);
  });
}
```

---

## 🔍 **Monitoring Checklist**

### Backend Instrumentation
- [ ] Prometheus client installed
- [ ] `/metrics` endpoint exposed
- [ ] HTTP request metrics tracked
- [ ] Custom business metrics implemented
- [ ] Sentry initialized
- [ ] Error capturing configured

### Frontend Instrumentation
- [ ] Sentry installed
- [ ] Error boundary implemented
- [ ] User context being set
- [ ] Performance monitoring enabled
- [ ] Session replay configured (optional)

### Infrastructure
- [ ] Prometheus deployed
- [ ] Grafana deployed
- [ ] ServiceMonitor created
- [ ] Alerts configured
- [ ] Alertmanager configured
- [ ] Slack/PagerDuty integration tested

### Dashboards
- [ ] Main dashboard imported
- [ ] Dashboard tested with real data
- [ ] Team has access to Grafana
- [ ] Alert rules validated

### Documentation
- [ ] Team trained on dashboard usage
- [ ] Runbooks created for alerts
- [ ] On-call rotation defined
- [ ] Escalation procedures documented

---

## 📈 **Next Steps**

1. **Baseline Your Metrics**: Run the system for 1 week to establish baseline metrics
2. **Tune Alert Thresholds**: Adjust thresholds based on actual usage patterns
3. **Create Runbooks**: Document response procedures for each alert
4. **Regular Reviews**: Schedule weekly monitoring reviews
5. **Capacity Planning**: Use metrics to forecast resource needs

---

## 🆘 **Troubleshooting**

### Metrics Not Showing in Prometheus

1. Check ServiceMonitor:
   ```bash
   kubectl get servicemonitor -n lifeos
   kubectl describe servicemonitor lifeos-backend -n lifeos
   ```

2. Check Prometheus targets:
   ```bash
   kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
   # Visit http://localhost:9090/targets
   ```

3. Check if metrics endpoint is working:
   ```bash
   kubectl port-forward svc/lifeos-backend 8001:8001 -n lifeos
   curl http://localhost:8001/metrics
   ```

### Alerts Not Firing

1. Check PrometheusRule:
   ```bash
   kubectl get prometheusrule -n monitoring
   kubectl describe prometheusrule lifeos-alerts -n monitoring
   ```

2. Check Alertmanager:
   ```bash
   kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n monitoring
   # Visit http://localhost:9093
   ```

3. Verify alert expression in Prometheus:
   - Go to http://localhost:9090/graph
   - Enter your alert expression
   - Check if it returns results

### Sentry Not Receiving Events

1. Check DSN configuration in `.env`
2. Check network connectivity:
   ```bash
   curl -I https://sentry.io
   ```
3. Enable debug mode:
   ```typescript
   Sentry.init({
     dsn: '...',
     debug: true,
   });
   ```
4. Check Sentry project settings

---

## 📚 **Additional Resources**

- [Monitoring Architecture](./MONITORING_ARCHITECTURE.md) - Complete strategy and KPIs
- [Prometheus Instrumentation](./prometheus-instrumentation.ts) - Code examples
- [Sentry Integration](./SENTRY_INTEGRATION.md) - Detailed Sentry setup
- [Kubernetes Monitoring](../k8s/README.md) - K8s-specific monitoring setup
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Sentry Documentation](https://docs.sentry.io/)

---

## 💬 **Support**

For questions or issues:
- GitHub: https://github.com/lifeos/platform/issues
- Slack: #lifeos-monitoring
- Email: devops@lifeos.io
