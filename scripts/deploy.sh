#!/bin/bash

# TransPipe Backend Deployment Script

set -e

echo "🚀 Starting TransPipe Backend Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if kubectl is available for Kubernetes deployment
if command -v kubectl &> /dev/null; then
    KUBECTL_AVAILABLE=true
    print_status "kubectl found - Kubernetes deployment available"
else
    KUBECTL_AVAILABLE=false
    print_warning "kubectl not found - Kubernetes deployment will be skipped"
fi

# Build Docker image
print_status "Building Docker image..."
docker build -t transpipe-backend:latest .

# Option 1: Docker Compose deployment (default)
if [[ "${1:-docker}" == "docker" ]]; then
    print_status "Deploying with Docker Compose..."
    
    # Stop existing containers
    docker-compose down
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        print_status "✅ Services are running!"
        print_status "API available at: http://localhost:5070"
        print_status "Health check: http://localhost:5070/health"
    else
        print_error "❌ Services failed to start"
        docker-compose logs
        exit 1
    fi

# Option 2: Kubernetes deployment
elif [[ "$1" == "k8s" ]] && [[ "$KUBECTL_AVAILABLE" == true ]]; then
    print_status "Deploying to Kubernetes..."
    
    # Apply Kubernetes manifests
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/postgres-secret.yaml
    kubectl apply -f k8s/app-secret.yaml
    kubectl apply -f k8s/postgres-pvc.yaml
    kubectl apply -f k8s/postgres-deployment.yaml
    kubectl apply -f k8s/postgres-service.yaml
    kubectl apply -f k8s/app-deployment.yaml
    kubectl apply -f k8s/app-service.yaml
    
    # Wait for deployments
    print_status "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres-deployment -n transpipe
    kubectl wait --for=condition=available --timeout=300s deployment/transpipe-api-deployment -n transpipe
    
    # Get service information
    print_status "✅ Kubernetes deployment complete!"
    kubectl get services -n transpipe
    
else
    print_error "Invalid deployment option or kubectl not available"
    echo "Usage: $0 [docker|k8s]"
    echo "  docker: Deploy using Docker Compose (default)"
    echo "  k8s:    Deploy to Kubernetes cluster"
    exit 1
fi

print_status "🎉 TransPipe Backend deployment completed successfully!"