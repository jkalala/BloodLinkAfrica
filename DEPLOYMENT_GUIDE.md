# BloodLink Africa - Production Deployment Guide

## 🚀 Complete Production Deployment

This guide provides comprehensive instructions for deploying BloodLink Africa to production with enterprise-grade features, monitoring, and security.

## 📋 Prerequisites

### Required Tools
- **Docker** (v20.10+)
- **Kubernetes** (v1.24+)
- **kubectl** (v1.24+)
- **Helm** (v3.8+)
- **Node.js** (v18+)
- **Git** (v2.30+)

### Infrastructure Requirements
- **Kubernetes Cluster** (EKS, GKE, or AKS)
- **Container Registry** (ECR, GCR, or ACR)
- **Domain Name** with DNS management
- **SSL Certificates** (Let's Encrypt or custom)
- **Monitoring Stack** (Prometheus/Grafana)

## 🏗️ Architecture Overview

```
Internet → Load Balancer → Ingress Controller → Services → Pods
                                ↓
                         [Frontend Pods] → [API Pods] → [Database]
                                ↓              ↓           ↓
                         [Redis Cache] ← [Monitoring] → [Logging]
```

## 🔧 Environment Setup

### 1. Clone Repository
```bash
git clone https://github.com/jkalala/BloodLinkAfrica.git
cd BloodLinkAfrica
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env.production

# Configure production variables
export NODE_ENV=production
export DATABASE_URL="postgresql://user:pass@host:5432/bloodlink_production"
export REDIS_URL="redis://user:pass@host:6379/0"
export JWT_SECRET="your-super-secure-jwt-secret"
export ENCRYPTION_KEY="your-32-character-encryption-key"
```

### 3. Docker Registry Setup
```bash
# Build and tag images
docker build -t your-registry/bloodlink-api:v2.0.0 -f Dockerfile.api .
docker build -t your-registry/bloodlink-frontend:v2.0.0 -f Dockerfile.frontend .

# Push to registry
docker push your-registry/bloodlink-api:v2.0.0
docker push your-registry/bloodlink-frontend:v2.0.0
```

## 🚀 Kubernetes Deployment

### 1. Quick Deployment
```bash
# One-command deployment
npm run k8s:deploy

# Or manual deployment
bash scripts/k8s-deploy.sh
```

### 2. Manual Step-by-Step Deployment

#### Create Namespaces
```bash
kubectl apply -f k8s/production/namespace.yaml
```

#### Deploy Secrets
```bash
# Create application secrets
kubectl create secret generic bloodlink-secrets \
  --from-literal=database-url="${DATABASE_URL}" \
  --from-literal=redis-url="${REDIS_URL}" \
  --from-literal=jwt-secret="${JWT_SECRET}" \
  --from-literal=encryption-key="${ENCRYPTION_KEY}" \
  -n bloodlink-production
```

#### Deploy Database
```bash
kubectl apply -f k8s/production/database-deployment.yaml
kubectl wait --for=condition=ready pod -l app=postgres -n bloodlink-production --timeout=300s
```

#### Deploy Redis
```bash
kubectl apply -f k8s/production/redis-deployment.yaml
kubectl wait --for=condition=ready pod -l app=redis -n bloodlink-production --timeout=300s
```

#### Deploy API
```bash
kubectl apply -f k8s/production/api-deployment.yaml
kubectl wait --for=condition=ready pod -l app=bloodlink-api -n bloodlink-production --timeout=300s
```

#### Deploy Frontend
```bash
kubectl apply -f k8s/production/frontend-deployment.yaml
kubectl wait --for=condition=ready pod -l app=bloodlink-frontend -n bloodlink-production --timeout=300s
```

#### Deploy Ingress
```bash
# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx --create-namespace --namespace ingress-nginx

# Install Cert-Manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true

# Apply ingress configuration
kubectl apply -f k8s/production/ingress.yaml
```

#### Deploy Monitoring
```bash
kubectl apply -f k8s/production/monitoring.yaml
kubectl wait --for=condition=ready pod -l app=prometheus -n bloodlink-monitoring --timeout=300s
kubectl wait --for=condition=ready pod -l app=grafana -n bloodlink-monitoring --timeout=300s
```

## 🔍 Verification & Testing

### 1. Health Checks
```bash
# Check pod status
kubectl get pods -n bloodlink-production

# Check services
kubectl get services -n bloodlink-production

# Check ingress
kubectl get ingress -n bloodlink-production
```

### 2. Application Testing
```bash
# Run comprehensive tests
npm run test:all

# Run quality analysis
npm run qa:full

# Performance testing
npm run performance:test
```

### 3. Load Testing
```bash
# Install k6 for load testing
curl https://github.com/grafana/k6/releases/download/v0.42.0/k6-v0.42.0-linux-amd64.tar.gz -L | tar xvz --strip-components 1

# Run load tests
k6 run tests/load/api-load-test.js
```

## 📊 Monitoring & Observability

### 1. Access Monitoring Dashboards
```bash
# Port forward to Grafana
kubectl port-forward svc/grafana-service 3000:3000 -n bloodlink-monitoring

# Access at http://localhost:3000
# Default credentials: admin / GrafanaAdminPassword2024!
```

### 2. Prometheus Metrics
```bash
# Port forward to Prometheus
kubectl port-forward svc/prometheus-service 9090:9090 -n bloodlink-monitoring

# Access at http://localhost:9090
```

### 3. Application Logs
```bash
# View API logs
kubectl logs -f deployment/bloodlink-api -n bloodlink-production

# View Frontend logs
kubectl logs -f deployment/bloodlink-frontend -n bloodlink-production

# View Database logs
kubectl logs -f statefulset/postgres -n bloodlink-production
```

## 🔒 Security Configuration

### 1. SSL/TLS Setup
```bash
# Verify SSL certificates
kubectl get certificates -n bloodlink-production

# Check certificate status
kubectl describe certificate bloodlink-tls-certificate -n bloodlink-production
```

### 2. Network Policies
```bash
# Verify network policies
kubectl get networkpolicies -n bloodlink-production

# Test network connectivity
kubectl exec -it deployment/bloodlink-api -n bloodlink-production -- curl postgres-service:5432
```

### 3. Security Scanning
```bash
# Run security tests
npm run test:security

# Container image scanning
docker scan your-registry/bloodlink-api:v2.0.0
```

## 📈 Scaling & Performance

### 1. Horizontal Pod Autoscaling
```bash
# Check HPA status
kubectl get hpa -n bloodlink-production

# Manual scaling
kubectl scale deployment bloodlink-api --replicas=5 -n bloodlink-production
```

### 2. Resource Monitoring
```bash
# Check resource usage
kubectl top pods -n bloodlink-production
kubectl top nodes
```

### 3. Performance Optimization
```bash
# Run performance analysis
npm run performance:analyze

# Generate performance report
npm run performance:report
```

## 🔄 CI/CD Integration

### 1. GitHub Actions Setup
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Deploy to Kubernetes
      run: |
        npm run k8s:deploy
```

### 2. Automated Testing
```bash
# Run in CI environment
CI=true npm run test:all
CI=true npm run qa:full
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Pod Startup Issues
```bash
# Check pod events
kubectl describe pod <pod-name> -n bloodlink-production

# Check logs
kubectl logs <pod-name> -n bloodlink-production --previous
```

#### 2. Database Connection Issues
```bash
# Test database connectivity
kubectl exec -it deployment/bloodlink-api -n bloodlink-production -- npm run db:test

# Check database logs
kubectl logs statefulset/postgres -n bloodlink-production
```

#### 3. Ingress Issues
```bash
# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify DNS resolution
nslookup bloodlink.africa
```

#### 4. SSL Certificate Issues
```bash
# Check certificate status
kubectl describe certificate -n bloodlink-production

# Force certificate renewal
kubectl delete certificate bloodlink-tls-certificate -n bloodlink-production
kubectl apply -f k8s/production/ingress.yaml
```

## 🔧 Maintenance

### 1. Database Backups
```bash
# Manual backup
kubectl exec -it statefulset/postgres -n bloodlink-production -- pg_dump -U bloodlink bloodlink_production > backup.sql

# Restore from backup
kubectl exec -i statefulset/postgres -n bloodlink-production -- psql -U bloodlink bloodlink_production < backup.sql
```

### 2. Updates & Rollbacks
```bash
# Update application
kubectl set image deployment/bloodlink-api bloodlink-api=your-registry/bloodlink-api:v2.1.0 -n bloodlink-production

# Rollback deployment
kubectl rollout undo deployment/bloodlink-api -n bloodlink-production

# Check rollout status
kubectl rollout status deployment/bloodlink-api -n bloodlink-production
```

### 3. Resource Cleanup
```bash
# Clean up old resources
kubectl delete pods --field-selector=status.phase=Succeeded -n bloodlink-production

# Clean up old images
docker system prune -a
```

## 📞 Support & Monitoring

### 1. Health Endpoints
- **API Health**: `https://api.bloodlink.africa/health`
- **Frontend Health**: `https://bloodlink.africa/health`
- **Database Health**: Internal monitoring

### 2. Monitoring URLs
- **Grafana**: `https://grafana.bloodlink.africa`
- **Prometheus**: Internal access only
- **Application Metrics**: Integrated in Grafana

### 3. Alert Channels
- **Email**: alerts@bloodlink.africa
- **Slack**: #bloodlink-alerts
- **PagerDuty**: Production incidents

## 🎯 Performance Targets

### Application Performance
- **Response Time**: < 500ms (95th percentile)
- **Throughput**: > 1000 requests/second
- **Error Rate**: < 1%
- **Uptime**: > 99.9%

### Infrastructure Performance
- **CPU Usage**: < 70% average
- **Memory Usage**: < 80% average
- **Disk Usage**: < 80%
- **Network Latency**: < 50ms internal

## 📚 Additional Resources

- **API Documentation**: `https://api.bloodlink.africa/docs`
- **Admin Dashboard**: `https://admin.bloodlink.africa`
- **Status Page**: `https://status.bloodlink.africa`
- **Support**: `support@bloodlink.africa`

---

## 🚀 Quick Start Commands

```bash
# Complete deployment
npm run k8s:deploy

# Check status
npm run k8s:status

# Run tests
npm run test:all

# Quality analysis
npm run qa:full

# Performance monitoring
npm run performance:monitor
```

**BloodLink Africa is now ready for production! 🩸✨**
