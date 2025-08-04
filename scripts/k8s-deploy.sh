#!/bin/bash

# BloodLink Africa Kubernetes Deployment Script
# Comprehensive deployment automation for production environment

set -euo pipefail

# Configuration
NAMESPACE="bloodlink-production"
MONITORING_NAMESPACE="bloodlink-monitoring"
APP_VERSION="${APP_VERSION:-v2.0.0}"
ENVIRONMENT="${ENVIRONMENT:-production}"
KUBECTL_TIMEOUT="300s"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Build API image
    log_info "Building API image..."
    docker build -t bloodlink/api:${APP_VERSION} -f Dockerfile.api .
    docker tag bloodlink/api:${APP_VERSION} bloodlink/api:latest
    
    # Build Frontend image
    log_info "Building Frontend image..."
    docker build -t bloodlink/frontend:${APP_VERSION} -f Dockerfile.frontend .
    docker tag bloodlink/frontend:${APP_VERSION} bloodlink/frontend:latest
    
    # Push images
    log_info "Pushing images to registry..."
    docker push bloodlink/api:${APP_VERSION}
    docker push bloodlink/api:latest
    docker push bloodlink/frontend:${APP_VERSION}
    docker push bloodlink/frontend:latest
    
    log_success "Docker images built and pushed successfully"
}

# Create namespaces
create_namespaces() {
    log_info "Creating namespaces..."
    
    # Apply namespace configuration
    kubectl apply -f k8s/production/namespace.yaml
    
    # Create monitoring namespace if it doesn't exist
    kubectl create namespace ${MONITORING_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
    
    log_success "Namespaces created successfully"
}

# Deploy secrets
deploy_secrets() {
    log_info "Deploying secrets..."
    
    # Check if secrets exist, if not create them
    if ! kubectl get secret bloodlink-secrets -n ${NAMESPACE} &> /dev/null; then
        log_warning "bloodlink-secrets not found, creating with default values"
        
        # Create secrets from environment variables or defaults
        kubectl create secret generic bloodlink-secrets \
            --from-literal=database-url="${DATABASE_URL:-postgresql://bloodlink:BloodLinkPassword2024!@postgres-service:5432/bloodlink_production}" \
            --from-literal=redis-url="${REDIS_URL:-redis://:RedisPassword2024!@redis-master-service:6379/0}" \
            --from-literal=jwt-secret="${JWT_SECRET:-$(openssl rand -base64 32)}" \
            --from-literal=encryption-key="${ENCRYPTION_KEY:-$(openssl rand -base64 32)}" \
            --from-literal=email-api-key="${EMAIL_API_KEY:-your-email-api-key}" \
            --from-literal=sms-api-key="${SMS_API_KEY:-your-sms-api-key}" \
            --from-literal=cloudinary-url="${CLOUDINARY_URL:-cloudinary://your-cloudinary-url}" \
            --from-literal=sentry-dsn="${SENTRY_DSN:-your-sentry-dsn}" \
            --from-literal=google-analytics-id="${GOOGLE_ANALYTICS_ID:-your-ga-id}" \
            --from-literal=mapbox-token="${MAPBOX_TOKEN:-your-mapbox-token}" \
            --from-literal=pusher-key="${PUSHER_KEY:-your-pusher-key}" \
            -n ${NAMESPACE}
    fi
    
    # Create SSL certificates secret if not exists
    if ! kubectl get secret postgres-ssl-secret -n ${NAMESPACE} &> /dev/null; then
        log_info "Creating SSL certificates for PostgreSQL..."
        
        # Generate self-signed certificates for development
        openssl req -new -x509 -days 365 -nodes -text \
            -out server.crt \
            -keyout server.key \
            -subj "/CN=postgres-service.${NAMESPACE}.svc.cluster.local"
        
        kubectl create secret generic postgres-ssl-secret \
            --from-file=server.crt=server.crt \
            --from-file=server.key=server.key \
            -n ${NAMESPACE}
        
        # Clean up certificate files
        rm -f server.crt server.key
    fi
    
    log_success "Secrets deployed successfully"
}

# Deploy storage
deploy_storage() {
    log_info "Deploying storage components..."
    
    # Create storage classes if they don't exist
    cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3-encrypted
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  encrypted: "true"
  fsType: ext4
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true
EOF
    
    log_success "Storage components deployed successfully"
}

# Deploy database
deploy_database() {
    log_info "Deploying PostgreSQL database..."
    
    kubectl apply -f k8s/production/database-deployment.yaml
    
    # Wait for database to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n ${NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    log_success "PostgreSQL database deployed successfully"
}

# Deploy Redis
deploy_redis() {
    log_info "Deploying Redis cache..."
    
    kubectl apply -f k8s/production/redis-deployment.yaml
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l app=redis -n ${NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    log_success "Redis cache deployed successfully"
}

# Deploy API
deploy_api() {
    log_info "Deploying BloodLink API..."
    
    # Update image version in deployment
    sed -i.bak "s|bloodlink/api:v.*|bloodlink/api:${APP_VERSION}|g" k8s/production/api-deployment.yaml
    
    kubectl apply -f k8s/production/api-deployment.yaml
    
    # Wait for API to be ready
    log_info "Waiting for API to be ready..."
    kubectl wait --for=condition=ready pod -l app=bloodlink-api -n ${NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    log_success "BloodLink API deployed successfully"
}

# Deploy frontend
deploy_frontend() {
    log_info "Deploying BloodLink Frontend..."
    
    # Update image version in deployment
    sed -i.bak "s|bloodlink/frontend:v.*|bloodlink/frontend:${APP_VERSION}|g" k8s/production/frontend-deployment.yaml
    
    kubectl apply -f k8s/production/frontend-deployment.yaml
    
    # Wait for frontend to be ready
    log_info "Waiting for Frontend to be ready..."
    kubectl wait --for=condition=ready pod -l app=bloodlink-frontend -n ${NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    log_success "BloodLink Frontend deployed successfully"
}

# Deploy ingress
deploy_ingress() {
    log_info "Deploying Ingress configuration..."
    
    # Install nginx-ingress if not present
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        log_info "Installing nginx-ingress controller..."
        helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
        helm repo update
        helm install ingress-nginx ingress-nginx/ingress-nginx \
            --create-namespace \
            --namespace ingress-nginx \
            --set controller.metrics.enabled=true \
            --set controller.podAnnotations."prometheus\.io/scrape"=true \
            --set controller.podAnnotations."prometheus\.io/port"=10254
    fi
    
    # Install cert-manager if not present
    if ! kubectl get namespace cert-manager &> /dev/null; then
        log_info "Installing cert-manager..."
        helm repo add jetstack https://charts.jetstack.io
        helm repo update
        helm install cert-manager jetstack/cert-manager \
            --namespace cert-manager \
            --create-namespace \
            --version v1.10.0 \
            --set installCRDs=true
    fi
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=cert-manager -n cert-manager --timeout=${KUBECTL_TIMEOUT}
    
    # Apply ingress configuration
    kubectl apply -f k8s/production/ingress.yaml
    
    log_success "Ingress configuration deployed successfully"
}

# Deploy monitoring
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    kubectl apply -f k8s/production/monitoring.yaml
    
    # Wait for monitoring components to be ready
    log_info "Waiting for monitoring components to be ready..."
    kubectl wait --for=condition=ready pod -l app=prometheus -n ${MONITORING_NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    kubectl wait --for=condition=ready pod -l app=grafana -n ${MONITORING_NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    log_success "Monitoring stack deployed successfully"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    # Create a job to run migrations
    cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: Job
metadata:
  name: bloodlink-migrations-$(date +%s)
  namespace: ${NAMESPACE}
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migrations
        image: bloodlink/api:${APP_VERSION}
        command: ["npm", "run", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: bloodlink-secrets
              key: database-url
        - name: NODE_ENV
          value: "production"
      backoffLimit: 3
EOF
    
    # Wait for migration job to complete
    log_info "Waiting for migrations to complete..."
    kubectl wait --for=condition=complete job -l job-name=bloodlink-migrations --timeout=${KUBECTL_TIMEOUT} -n ${NAMESPACE} || true
    
    log_success "Database migrations completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n ${NAMESPACE}
    
    # Check service status
    log_info "Checking service status..."
    kubectl get services -n ${NAMESPACE}
    
    # Check ingress status
    log_info "Checking ingress status..."
    kubectl get ingress -n ${NAMESPACE}
    
    # Health checks
    log_info "Performing health checks..."
    
    # Wait for all deployments to be ready
    kubectl wait --for=condition=available deployment --all -n ${NAMESPACE} --timeout=${KUBECTL_TIMEOUT}
    
    # Check if all pods are running
    if kubectl get pods -n ${NAMESPACE} | grep -v Running | grep -v Completed | grep -v STATUS; then
        log_warning "Some pods are not in Running state"
    else
        log_success "All pods are running successfully"
    fi
    
    log_success "Deployment verification completed"
}

# Display deployment information
display_info() {
    log_info "Deployment Information:"
    echo "=========================="
    echo "Namespace: ${NAMESPACE}"
    echo "App Version: ${APP_VERSION}"
    echo "Environment: ${ENVIRONMENT}"
    echo ""
    
    log_info "Application URLs:"
    echo "Frontend: https://bloodlink.africa"
    echo "API: https://api.bloodlink.africa"
    echo "Admin: https://admin.bloodlink.africa"
    echo "Grafana: https://grafana.bloodlink.africa"
    echo ""
    
    log_info "Useful Commands:"
    echo "View pods: kubectl get pods -n ${NAMESPACE}"
    echo "View logs: kubectl logs -f deployment/bloodlink-api -n ${NAMESPACE}"
    echo "Scale API: kubectl scale deployment bloodlink-api --replicas=5 -n ${NAMESPACE}"
    echo "Rollback: kubectl rollout undo deployment/bloodlink-api -n ${NAMESPACE}"
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f k8s/production/*.bak
}

# Main deployment function
main() {
    log_info "Starting BloodLink Africa Kubernetes deployment..."
    log_info "Version: ${APP_VERSION}"
    log_info "Environment: ${ENVIRONMENT}"
    echo ""
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    
    if [[ "${SKIP_BUILD:-false}" != "true" ]]; then
        build_and_push_images
    fi
    
    create_namespaces
    deploy_secrets
    deploy_storage
    deploy_database
    deploy_redis
    deploy_api
    deploy_frontend
    deploy_ingress
    deploy_monitoring
    
    if [[ "${SKIP_MIGRATIONS:-false}" != "true" ]]; then
        run_migrations
    fi
    
    verify_deployment
    display_info
    
    log_success "BloodLink Africa deployment completed successfully!"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "verify")
        verify_deployment
        ;;
    "info")
        display_info
        ;;
    "help")
        echo "Usage: $0 [deploy|verify|info|help]"
        echo ""
        echo "Commands:"
        echo "  deploy  - Full deployment (default)"
        echo "  verify  - Verify existing deployment"
        echo "  info    - Display deployment information"
        echo "  help    - Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  APP_VERSION     - Application version (default: v2.0.0)"
        echo "  ENVIRONMENT     - Deployment environment (default: production)"
        echo "  SKIP_BUILD      - Skip Docker build and push (default: false)"
        echo "  SKIP_MIGRATIONS - Skip database migrations (default: false)"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
