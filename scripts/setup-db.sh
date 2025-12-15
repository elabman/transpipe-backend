#!/bin/bash

# Database setup script for TransPipe

set -e

echo "🗄️  Setting up TransPipe Database..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Start only PostgreSQL service
print_status "Starting PostgreSQL container..."
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
print_status "Waiting for PostgreSQL to be ready..."
sleep 10

# Check if PostgreSQL is running
if docker-compose ps postgres | grep -q "Up"; then
    print_status "✅ PostgreSQL is running!"
    
    # Run migrations
    print_status "Running database migrations..."
    npm run migrate
    
    print_status "🎉 Database setup completed successfully!"
    print_status "Database is available at: localhost:5432"
    print_status "Database name: transpipe_db"
    print_status "Username: transpipe_user"
else
    print_error "❌ PostgreSQL failed to start"
    docker-compose logs postgres
    exit 1
fi