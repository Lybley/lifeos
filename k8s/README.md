# LifeOS Kubernetes Deployment Guide

## Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Helm 3.x
- cert-manager (for TLS certificates)
- nginx-ingress-controller
- metrics-server (for HPA)

## Quick Start

### 1. Create Namespace

```bash
kubectl apply -f namespace.yaml
```

### 2. Configure Secrets

**Important:** Update `secrets.yaml` with your actual credentials before applying!

```bash
# Edit secrets.yaml with real values
vim secrets.yaml

# Apply secrets
kubectl apply -f secrets.yaml
```

**Better approach (using sealed-secrets):**

```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets --namespace kube-system

# Create sealed secret
kubeseal -f secrets.yaml -w sealed-secrets.yaml
kubectl apply -f sealed-secrets.yaml
```

### 3. Apply ConfigMaps

```bash
kubectl apply -f configmap.yaml
```

### 4. Deploy Backend

```bash
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
```

### 5. Deploy Frontend

```bash
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
```

### 6. Configure Ingress

```bash
# Install nginx-ingress-controller if not already installed
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Install cert-manager for TLS
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Apply ingress
kubectl apply -f ingress.yaml
```

### 7. Enable Autoscaling

```bash
# Install metrics-server if not already installed
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Apply HPA
kubectl apply -f hpa.yaml
```

### 8. Apply Network Policies (Optional but Recommended)

```bash
kubectl apply -f network-policy.yaml
```

## Verify Deployment

```bash
# Check pods
kubectl get pods -n lifeos

# Check services
kubectl get svc -n lifeos

# Check ingress
kubectl get ingress -n lifeos

# Check HPA
kubectl get hpa -n lifeos

# View logs
kubectl logs -f deployment/lifeos-backend -n lifeos
kubectl logs -f deployment/lifeos-frontend -n lifeos
```

## Health Checks

### Backend Health
```bash
kubectl port-forward svc/lifeos-backend 8000:8000 -n lifeos
curl http://localhost:8000/health
```

### Frontend Health
```bash
kubectl port-forward svc/lifeos-frontend 3000:3000 -n lifeos
curl http://localhost:3000
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment/lifeos-backend --replicas=5 -n lifeos

# Scale frontend
kubectl scale deployment/lifeos-frontend --replicas=3 -n lifeos
```

### Autoscaling Guidelines

The HPA configuration will automatically scale based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Custom metrics (requests per second)

**Scale-up behavior:**
- Adds up to 100% more pods every 30 seconds
- Or adds 4 pods every 30 seconds (whichever is higher)

**Scale-down behavior:**
- Removes up to 50% of pods every 60 seconds
- Or removes 2 pods every 60 seconds (whichever is lower)
- Waits 5 minutes before scaling down for stability

## Rolling Updates

```bash
# Update backend image
kubectl set image deployment/lifeos-backend \
  backend=registry.lifeos.io/backend:v1.2.0 \
  -n lifeos

# Watch rollout status
kubectl rollout status deployment/lifeos-backend -n lifeos

# Rollback if needed
kubectl rollout undo deployment/lifeos-backend -n lifeos
```

## Troubleshooting

### Pod Not Starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n lifeos

# Check events
kubectl get events -n lifeos --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n lifeos --previous
```

### Database Connection Issues

```bash
# Test PostgreSQL connection from pod
kubectl exec -it <backend-pod> -n lifeos -- \
  psql -h postgresql.lifeos.svc.cluster.local -U lifeos_user -d lifeos

# Test Redis connection
kubectl exec -it <backend-pod> -n lifeos -- \
  redis-cli -h redis.lifeos.svc.cluster.local ping
```

### High Memory/CPU Usage

```bash
# Check resource usage
kubectl top pods -n lifeos
kubectl top nodes

# Increase resources if needed
kubectl edit deployment/lifeos-backend -n lifeos
# Update resources.limits and resources.requests
```

## Monitoring & Observability

### Complete Monitoring Stack Setup

LifeOS uses a comprehensive monitoring stack with Prometheus, Grafana, and Sentry. See `/app/monitoring/MONITORING_ARCHITECTURE.md` for full details.

### 1. Install Prometheus & Grafana

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (includes Prometheus, Grafana, and Alertmanager)
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin123
```

### 2. Create ServiceMonitor for LifeOS

Create `lifeos-servicemonitor.yaml`:

```yaml
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
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: lifeos-frontend
  namespace: lifeos
  labels:
    app: lifeos-frontend
spec:
  selector:
    matchLabels:
      app: lifeos-frontend
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
```

Apply the ServiceMonitor:

```bash
kubectl apply -f lifeos-servicemonitor.yaml
```

### 3. Import LifeOS Grafana Dashboard

```bash
# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Visit http://localhost:3000 (username: admin, password: admin123)

# Import the dashboard
# 1. Go to Dashboards → Import
# 2. Upload /app/monitoring/grafana-dashboard.json
# 3. Select Prometheus datasource
# 4. Click Import
```

### 4. Configure Prometheus Alerts

Create `lifeos-alerts.yaml`:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: lifeos-alerts
  namespace: monitoring
  labels:
    prometheus: kube-prometheus
spec:
  groups:
  - name: lifeos.rules
    interval: 30s
    rules:
    # Critical: Onboarding completion rate below 60%
    - alert: LowOnboardingRate
      expr: |
        (sum(increase(lifeos_onboarding_step_completed_total{step="complete"}[24h])) 
        / sum(increase(lifeos_onboarding_step_completed_total{step="welcome"}[24h]))) * 100 < 60
      for: 1h
      labels:
        severity: critical
      annotations:
        summary: "Low onboarding completion rate"
        description: "Onboarding rate is {{ $value }}%, below 60% threshold"
    
    # Critical: Data ingestion success rate below 95%
    - alert: LowIngestionSuccessRate
      expr: |
        (sum(increase(lifeos_ingestion_total{status="success"}[1h])) 
        / sum(increase(lifeos_ingestion_total[1h]))) * 100 < 95
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Low data ingestion success rate"
        description: "Ingestion success rate is {{ $value }}%, below 95%"
    
    # Warning: RAG response P95 latency above 3.5s
    - alert: HighRagLatency
      expr: |
        histogram_quantile(0.95, 
          rate(lifeos_rag_query_duration_seconds_bucket[5m])) > 3.5
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High RAG query latency"
        description: "P95 RAG latency is {{ $value }}s, above 3.5s threshold"
    
    # Critical: Action execution success rate below 95%
    - alert: LowActionSuccessRate
      expr: |
        (sum(increase(lifeos_action_execution_total{status="success"}[1h])) 
        / sum(increase(lifeos_action_execution_total[1h]))) * 100 < 95
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Low action execution success rate"
        description: "Action success rate is {{ $value }}%, below 95%"
    
    # High action queue size
    - alert: HighActionQueueSize
      expr: lifeos_action_queue_size > 100
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High action queue size"
        description: "Action queue has {{ $value }} items"
```

Apply the alerts:

```bash
kubectl apply -f lifeos-alerts.yaml
```

### 5. Configure Alertmanager

Create `alertmanager-config.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertmanager-prometheus-kube-prometheus-alertmanager
  namespace: monitoring
type: Opaque
stringData:
  alertmanager.yaml: |
    global:
      resolve_timeout: 5m
    
    route:
      receiver: 'default'
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      routes:
      - match:
          severity: critical
        receiver: 'critical'
        continue: true
      - match:
          severity: warning
        receiver: 'warning'
    
    receivers:
    - name: 'default'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#monitoring'
        title: 'LifeOS Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    
    - name: 'critical'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#incidents'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
      pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
    
    - name: 'warning'
      slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK_URL'
        channel: '#alerts'
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

Apply the configuration:

```bash
kubectl apply -f alertmanager-config.yaml
```

### 6. Sentry Integration

Follow the complete Sentry setup guide at `/app/monitoring/SENTRY_INTEGRATION.md`.

**Quick setup:**

```bash
# Install Sentry SDK in backend
cd /app/backend
yarn add @sentry/node @sentry/profiling-node

# Install Sentry SDK in frontend
cd /app/frontend
yarn add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Configure environment variables:
```env
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
```

### 7. Log Aggregation with ELK Stack (Optional)

```bash
# Install ECK (Elastic Cloud on Kubernetes)
kubectl create -f https://download.elastic.co/downloads/eck/2.10.0/crds.yaml
kubectl apply -f https://download.elastic.co/downloads/eck/2.10.0/operator.yaml

# Deploy Elasticsearch
kubectl apply -f - <<EOF
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: lifeos-logs
  namespace: monitoring
spec:
  version: 8.11.0
  nodeSets:
  - name: default
    count: 3
    config:
      node.store.allow_mmap: false
EOF

# Deploy Kibana
kubectl apply -f - <<EOF
apiVersion: kibana.k8s.elastic.co/v1
kind: Kibana
metadata:
  name: lifeos-logs
  namespace: monitoring
spec:
  version: 8.11.0
  count: 1
  elasticsearchRef:
    name: lifeos-logs
EOF

# Deploy Filebeat
kubectl apply -f - <<EOF
apiVersion: beat.k8s.elastic.co/v1beta1
kind: Beat
metadata:
  name: lifeos-logs
  namespace: monitoring
spec:
  type: filebeat
  version: 8.11.0
  elasticsearchRef:
    name: lifeos-logs
  config:
    filebeat.inputs:
    - type: container
      paths:
      - /var/log/containers/*.log
  daemonSet:
    podTemplate:
      spec:
        dnsPolicy: ClusterFirstWithHostNet
        hostNetwork: true
        securityContext:
          runAsUser: 0
        containers:
        - name: filebeat
          volumeMounts:
          - name: varlogcontainers
            mountPath: /var/log/containers
          - name: varlogpods
            mountPath: /var/log/pods
        volumes:
        - name: varlogcontainers
          hostPath:
            path: /var/log/containers
        - name: varlogpods
          hostPath:
            path: /var/log/pods
EOF
```

Access Kibana:
```bash
kubectl port-forward svc/lifeos-logs-kb-http 5601:5601 -n monitoring
# Visit https://localhost:5601
```

### 8. Verify Monitoring Setup

```bash
# Check Prometheus targets
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090 -n monitoring
# Visit http://localhost:9090/targets

# Check Grafana dashboards
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Visit http://localhost:3000

# Check Alertmanager
kubectl port-forward svc/prometheus-kube-prometheus-alertmanager 9093:9093 -n monitoring
# Visit http://localhost:9093
```

### 9. Monitoring Best Practices

1. **Instrument Your Code**: Use the examples in `/app/monitoring/prometheus-instrumentation.ts`
2. **Set Proper Alert Thresholds**: Based on your SLOs
3. **Create Runbooks**: Document response procedures for each alert
4. **Regular Reviews**: Weekly alert quality reviews, monthly dashboard reviews
5. **Cost Optimization**: Monitor metrics storage and retention

### Monitoring Architecture

For complete architecture details, KPIs, and monitoring strategy, see:
- `/app/monitoring/MONITORING_ARCHITECTURE.md` - Complete monitoring strategy
- `/app/monitoring/prometheus-instrumentation.ts` - Code instrumentation examples
- `/app/monitoring/grafana-dashboard.json` - Pre-configured Grafana dashboard
- `/app/monitoring/SENTRY_INTEGRATION.md` - Error tracking setup

## Security Best Practices

1. **Use sealed-secrets or external secret management**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault

2. **Enable Pod Security Policies**
   ```bash
   kubectl apply -f pod-security-policy.yaml
   ```

3. **Regular Security Scans**
   ```bash
   # Scan images with Trivy
   trivy image registry.lifeos.io/backend:latest
   ```

4. **Network Policies**
   - Already configured in `network-policy.yaml`
   - Restricts pod-to-pod communication

5. **Resource Quotas**
   ```yaml
   apiVersion: v1
   kind: ResourceQuota
   metadata:
     name: lifeos-quota
     namespace: lifeos
   spec:
     hard:
       requests.cpu: "10"
       requests.memory: 20Gi
       limits.cpu: "20"
       limits.memory: 40Gi
   ```

## Backup & Disaster Recovery

### Backup ConfigMaps and Secrets

```bash
kubectl get configmap -n lifeos -o yaml > backup-configmap.yaml
kubectl get secret -n lifeos -o yaml > backup-secrets.yaml
```

### Backup Persistent Volumes

```bash
# Use Velero for cluster backups
helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
helm install velero vmware-tanzu/velero \
  --namespace velero \
  --create-namespace \
  --set configuration.provider=aws \
  --set configuration.backupStorageLocation.bucket=lifeos-backups

# Create backup
velero backup create lifeos-backup --include-namespaces lifeos
```

## Production Checklist

- [ ] Secrets properly configured (not using default values)
- [ ] TLS certificates configured and valid
- [ ] Resource limits set appropriately
- [ ] HPA configured and tested
- [ ] Monitoring and alerting set up
- [ ] Backup strategy in place
- [ ] Network policies applied
- [ ] Pod security policies enabled
- [ ] Liveness and readiness probes configured
- [ ] Logging aggregation configured
- [ ] CI/CD pipeline tested
- [ ] Disaster recovery plan documented

## Support

For issues or questions:
- GitHub: https://github.com/lifeos/platform/issues
- Slack: #lifeos-ops
- Email: ops@lifeos.io
