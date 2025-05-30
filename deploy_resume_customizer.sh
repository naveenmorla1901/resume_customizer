#!/bin/bash
# deploy_resume_customizer.sh
# Simple deployment script for Resume Customizer

set -e  # Exit on any error

echo "🚀 Starting Resume Customizer Deployment..."

PROJECT_DIR="/home/ubuntu/resume_customizer"
SERVICE_NAME="resume-customizer"

# Pull latest changes from GitHub (if this is a git repo)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes from GitHub..."
    git fetch origin
    git reset --hard origin/main
    git pull origin main
fi

# Activate virtual environment and install/update dependencies
echo "📦 Installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create temp_files directory if it doesn't exist
mkdir -p temp_files

# Set proper permissions
sudo chown -R ubuntu:ubuntu $PROJECT_DIR
chmod +x $PROJECT_DIR

# Check if .env file exists and has required variables
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your API keys:"
    echo "   nano $PROJECT_DIR/.env"
    exit 1
fi

# Test the application before deploying
echo "🧪 Testing application..."
cd $PROJECT_DIR
timeout 10s bash -c 'uvicorn app.main:app --host 127.0.0.1 --port 8003' &
sleep 5
TEST_PID=$!

# Basic health check
if curl -f http://127.0.0.1:8003/api/health > /dev/null 2>&1; then
    echo "✅ Application health check passed"
    kill $TEST_PID 2>/dev/null || true
else
    echo "❌ Application health check failed - check your .env configuration"
    kill $TEST_PID 2>/dev/null || true
    echo "🔧 Try running manually: uvicorn app.main:app --host 0.0.0.0 --port 8003"
    exit 1
fi

# Stop the service if it's running
if systemctl list-unit-files | grep -q "^$SERVICE_NAME.service"; then
    echo "🛑 Stopping existing service..."
    sudo systemctl stop $SERVICE_NAME
else
    echo "📝 Service will be created..."
fi

# Start the service
echo "🔄 Starting Resume Customizer service..."
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl start $SERVICE_NAME

# Check service status
sleep 3
if sudo systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ Resume Customizer service is running on port 8002"
    echo "🌐 Application should be available at:"
    echo "   - http://170.9.227.112:8002/ (direct port access)"
    echo "   - After nginx config: http://170.9.227.112/resume-customizer/"
else
    echo "❌ Service failed to start. Checking logs..."
    sudo systemctl status $SERVICE_NAME
    sudo journalctl -u $SERVICE_NAME --lines=20
    exit 1
fi

# Test nginx configuration
echo "🔧 Testing nginx configuration..."
sudo nginx -t
if [ $? -eq 0 ]; then
    sudo systemctl reload nginx
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration test failed"
    echo "🔧 You may need to update nginx configuration manually"
fi

# Final health check
sleep 2
if curl -f http://127.0.0.1:8002/api/health > /dev/null 2>&1; then
    echo "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Service Status:"
    sudo systemctl status $SERVICE_NAME --no-pager --lines=3
    echo ""
    echo "🔗 Test your deployment:"
    echo "   Direct access: curl http://127.0.0.1:8002/api/health"
    echo "   External access: http://170.9.227.112:8002/"
else
    echo "❌ Final health check failed"
    echo "🔧 Try accessing directly: http://170.9.227.112:8002/"
fi
