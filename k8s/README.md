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

## Monitoring

### Prometheus & Grafana (Recommended)

```bash
# Install Prometheus Operator
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward svc/prometheus-grafana 3000:80 -n monitoring
# Visit http://localhost:3000 (admin/prom-operator)
```

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
