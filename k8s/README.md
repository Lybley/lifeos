# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying LifeOS Core to a production cluster.

## Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured to access your cluster
- Docker images built and pushed to a registry
- Ingress controller (nginx recommended)
- Certificate manager (cert-manager for TLS)

## Quick Deploy

```bash
# Apply all manifests
kubectl apply -f .

# Check deployment status
kubectl get all -n lifeos

# Watch pods come online
kubectl get pods -n lifeos -w
```

## Detailed Deployment Steps

### Step 1: Update Secrets

Before deploying, update `secrets.yaml` with your actual credentials:

```yaml
stringData:
  POSTGRES_USER: "your_postgres_user"
  POSTGRES_PASSWORD: "strong_password_here"
  NEO4J_PASSWORD: "strong_password_here"
  PINECONE_API_KEY: "your_actual_pinecone_key"
  AUTH0_DOMAIN: "your-tenant.auth0.com"
  AUTH0_CLIENT_ID: "your_actual_client_id"
  AUTH0_CLIENT_SECRET: "your_actual_client_secret"
```

**Important:** Never commit real secrets to version control!

### Step 2: Update ConfigMap (if needed)

Edit `configmap.yaml` if you need to change non-sensitive configuration:

```yaml
data:
  NODE_ENV: "production"
  POSTGRES_PORT: "5432"
  # ... other config
```

### Step 3: Update Ingress

Edit `ingress.yaml` to use your actual domain:

```yaml
spec:
  tls:
  - hosts:
    - your-domain.com  # Change this
    secretName: lifeos-tls
  rules:
  - host: your-domain.com  # Change this
```

### Step 4: Build and Push Docker Images

```bash
# Build images
docker build -t your-registry/lifeos-backend:latest ./backend
docker build -t your-registry/lifeos-frontend:latest ./frontend
docker build -t your-registry/lifeos-worker:latest ./worker

# Push to registry
docker push your-registry/lifeos-backend:latest
docker push your-registry/lifeos-frontend:latest
docker push your-registry/lifeos-worker:latest
```

### Step 5: Update Deployment Images

Edit deployment files to use your registry:

```yaml
# backend-deployment.yaml, frontend-deployment.yaml, worker-deployment.yaml
spec:
  template:
    spec:
      containers:
      - name: backend
        image: your-registry/lifeos-backend:latest
```

### Step 6: Deploy

```bash
# Create namespace
kubectl apply -f namespace.yaml

# Create ConfigMap and Secrets
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml

# Deploy databases
kubectl apply -f postgres-deployment.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f neo4j-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n lifeos --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n lifeos --timeout=300s
kubectl wait --for=condition=ready pod -l app=neo4j -n lifeos --timeout=300s

# Deploy applications
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f worker-deployment.yaml

# Deploy ingress
kubectl apply -f ingress.yaml
```

## Verification

### Check All Resources

```bash
kubectl get all -n lifeos
```

Expected output:
- 1 PostgreSQL pod
- 1 Redis pod
- 1 Neo4j pod
- 3 Backend pods
- 2 Frontend pods
- 2 Worker pods

### Check Pod Status

```bash
kubectl get pods -n lifeos
```

All pods should be in `Running` state with `READY 1/1`.

### Check Services

```bash
kubectl get svc -n lifeos
```

Services should include:
- postgres-service (ClusterIP)
- redis-service (ClusterIP)
- neo4j-service (ClusterIP)
- backend-service (ClusterIP)
- frontend-service (LoadBalancer)

### Check Ingress

```bash
kubectl get ingress -n lifeos
```

Should show your domain and the IP address.

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n lifeos

# Frontend logs
kubectl logs -f deployment/frontend -n lifeos

# Worker logs
kubectl logs -f deployment/worker -n lifeos

# Database logs
kubectl logs -f deployment/postgres -n lifeos
kubectl logs -f deployment/neo4j -n lifeos
kubectl logs -f deployment/redis -n lifeos
```

## Scaling

### Scale Backend

```bash
kubectl scale deployment/backend --replicas=5 -n lifeos
```

### Scale Frontend

```bash
kubectl scale deployment/frontend --replicas=3 -n lifeos
```

### Scale Worker

```bash
kubectl scale deployment/worker --replicas=4 -n lifeos
```

### Auto-scaling (HPA)

```bash
# Enable metrics-server first
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Create HPA for backend
kubectl autoscale deployment backend \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n lifeos

# Create HPA for frontend
kubectl autoscale deployment frontend \
  --cpu-percent=70 \
  --min=2 \
  --max=8 \
  -n lifeos

# Check HPA status
kubectl get hpa -n lifeos
```

## Updates and Rollouts

### Rolling Update

```bash
# Update backend image
kubectl set image deployment/backend \
  backend=your-registry/lifeos-backend:v2.0.0 \
  -n lifeos

# Watch rollout
kubectl rollout status deployment/backend -n lifeos
```

### Rollback

```bash
# Check rollout history
kubectl rollout history deployment/backend -n lifeos

# Rollback to previous version
kubectl rollout undo deployment/backend -n lifeos

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n lifeos
```

### Restart Deployment

```bash
kubectl rollout restart deployment/backend -n lifeos
kubectl rollout restart deployment/frontend -n lifeos
kubectl rollout restart deployment/worker -n lifeos
```

## Database Management

### PostgreSQL

```bash
# Connect to PostgreSQL
kubectl exec -it deployment/postgres -n lifeos -- psql -U postgres -d lifeos

# Backup database
kubectl exec deployment/postgres -n lifeos -- \
  pg_dump -U postgres lifeos > backup.sql

# Restore database
cat backup.sql | kubectl exec -i deployment/postgres -n lifeos -- \
  psql -U postgres lifeos
```

### Neo4j

```bash
# Access Neo4j browser
kubectl port-forward service/neo4j-service 7474:7474 -n lifeos
# Open http://localhost:7474

# Connect to Neo4j shell
kubectl exec -it deployment/neo4j -n lifeos -- \
  cypher-shell -u neo4j -p password
```

### Redis

```bash
# Connect to Redis CLI
kubectl exec -it deployment/redis -n lifeos -- redis-cli

# Monitor Redis
kubectl exec -it deployment/redis -n lifeos -- redis-cli MONITOR
```

## Monitoring

### Resource Usage

```bash
# Pod resource usage
kubectl top pods -n lifeos

# Node resource usage
kubectl top nodes
```

### Events

```bash
# Watch events
kubectl get events -n lifeos --sort-by='.lastTimestamp'

# Watch events in real-time
kubectl get events -n lifeos -w
```

### Describe Resources

```bash
# Describe pod
kubectl describe pod <pod-name> -n lifeos

# Describe deployment
kubectl describe deployment backend -n lifeos

# Describe service
kubectl describe service backend-service -n lifeos
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n lifeos

# Check logs
kubectl logs <pod-name> -n lifeos

# Check previous logs if crashed
kubectl logs <pod-name> --previous -n lifeos
```

### Service Not Accessible

```bash
# Test service from within cluster
kubectl run -it --rm debug --image=alpine --restart=Never -n lifeos -- sh
# Inside the pod:
apk add curl
curl http://backend-service:8000/health
```

### Database Connection Issues

```bash
# Check if database is running
kubectl get pods -n lifeos | grep postgres

# Check database logs
kubectl logs deployment/postgres -n lifeos

# Test connection
kubectl exec -it deployment/backend -n lifeos -- sh
# Inside the pod:
nc -zv postgres-service 5432
```

### Ingress Not Working

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx

# Check ingress resource
kubectl describe ingress lifeos-ingress -n lifeos

# Check ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

## Security Best Practices

1. **Use Secrets for Sensitive Data**
   - Never hardcode credentials
   - Use Kubernetes Secrets or external secret managers

2. **Network Policies**
   - Implement network policies to restrict pod-to-pod communication
   - Only allow necessary connections

3. **RBAC**
   - Use Role-Based Access Control
   - Limit service account permissions

4. **Pod Security**
   - Run containers as non-root
   - Use security contexts
   - Enable read-only root filesystem where possible

5. **Image Security**
   - Use official base images
   - Scan images for vulnerabilities
   - Use specific image tags (not `latest`)

## Backup and Disaster Recovery

### Database Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
kubectl exec deployment/postgres -n lifeos -- \
  pg_dump -U postgres lifeos > "postgres_backup_${DATE}.sql"

# Backup Neo4j
kubectl exec deployment/neo4j -n lifeos -- \
  neo4j-admin dump --to=/tmp/neo4j_backup_${DATE}.dump
kubectl cp lifeos/neo4j-pod:/tmp/neo4j_backup_${DATE}.dump \
  "./neo4j_backup_${DATE}.dump"

echo "Backup completed: ${DATE}"
EOF

chmod +x backup.sh
```

### Persistent Volume Backups

```bash
# List PVCs
kubectl get pvc -n lifeos

# Use Velero for cluster backups
velero backup create lifeos-backup --include-namespaces lifeos
```

## Cleanup

### Delete All Resources

```bash
# Delete entire namespace (careful!)
kubectl delete namespace lifeos
```

### Delete Specific Resources

```bash
# Delete deployments only
kubectl delete deployment --all -n lifeos

# Delete services only
kubectl delete service --all -n lifeos

# Keep databases, delete applications
kubectl delete deployment backend frontend worker -n lifeos
```

## Production Checklist

- [ ] Secrets updated with production credentials
- [ ] Domain name configured in Ingress
- [ ] TLS certificates configured
- [ ] Resource limits and requests set appropriately
- [ ] Health checks configured
- [ ] Monitoring and alerting set up
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented
- [ ] Auto-scaling configured
- [ ] Network policies implemented
- [ ] RBAC configured
- [ ] Load testing completed
- [ ] Security scanning performed

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Production Best Practices](https://kubernetes.io/docs/setup/best-practices/)
- [Security Best Practices](https://kubernetes.io/docs/concepts/security/)
