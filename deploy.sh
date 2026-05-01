#!/bin/bash

# ERP React - Quick Deployment Script
# This script sets up and deploys the entire ERP system

echo "🚀 ERP React - Deployment Script"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
check_docker() {
    echo -e "${YELLOW}[1/5] Checking Docker installation...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
        echo "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed. Please install it first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker & Docker Compose found${NC}"
}

# Check .env file
check_env() {
    echo -e "${YELLOW}[2/5] Checking environment configuration...${NC}"
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            echo -e "${YELLOW}⚠ Creating .env from template...${NC}"
            cp backend/.env.example backend/.env
            echo -e "${YELLOW}⚠ IMPORTANT: Edit backend/.env with your configuration${NC}"
            echo "   - Database password"
            echo "   - JWT secrets"
            echo "   - API keys"
            echo ""
            read -p "Press Enter to continue after editing .env, or Ctrl+C to stop..."
        else
            echo -e "${RED}❌ .env.example not found${NC}"
            exit 1
        fi
    fi
    echo -e "${GREEN}✓ Environment configuration ready${NC}"
}

# Build and start Docker containers
deploy_docker() {
    echo -e "${YELLOW}[3/5] Building Docker images...${NC}"
    docker-compose build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Docker build failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker images built${NC}"

    echo -e "${YELLOW}[4/5] Starting Docker containers...${NC}"
    docker-compose up -d
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Docker startup failed${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Docker containers started${NC}"

    # Wait for services to be ready
    echo -e "${YELLOW}Waiting for services to initialize (30 seconds)...${NC}"
    sleep 30
}

# Verify deployment
verify_deployment() {
    echo -e "${YELLOW}[5/5] Verifying deployment...${NC}"
    
    # Check backend
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend API responding${NC}"
    else
        echo -e "${RED}⚠ Backend API not responding yet (may need more time)${NC}"
    fi

    # Check frontend
    if curl -s http://localhost > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend web server responding${NC}"
    else
        echo -e "${RED}⚠ Frontend not responding yet (may need more time)${NC}"
    fi

    echo ""
}

# Display access information
show_access_info() {
    echo -e "${GREEN}=================================="
    echo "✅ Deployment Complete!"
    echo "==================================${NC}"
    echo ""
    echo -e "${YELLOW}Access Your System:${NC}"
    echo "  Frontend:   ${GREEN}http://localhost${NC}"
    echo "  Backend API: ${GREEN}http://localhost:3000/api${NC}"
    echo "  pgAdmin:    ${GREEN}http://localhost:5050${NC}"
    echo ""
    echo -e "${YELLOW}Default Credentials:${NC}"
    echo "  Email:    admin@company.com"
    echo "  Password: admin123"
    echo ""
    echo -e "${RED}⚠  IMPORTANT: Change these credentials immediately in production!${NC}"
    echo ""
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo "  View logs:       ${GREEN}docker-compose logs -f${NC}"
    echo "  Stop services:   ${GREEN}docker-compose down${NC}"
    echo "  Restart:         ${GREEN}docker-compose restart${NC}"
    echo "  Rebuild:         ${GREEN}docker-compose up -d --build${NC}"
    echo ""
    echo -e "${YELLOW}Documentation:${NC}"
    echo "  Setup Guide:           ${GREEN}SETUP_GUIDE.md${NC}"
    echo "  API Reference:         ${GREEN}API_REFERENCE.md${NC}"
    echo "  Verification Checklist: ${GREEN}VERIFICATION_CHECKLIST.md${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Open http://localhost in your browser"
    echo "  2. Login with admin@company.com / admin123"
    echo "  3. Configure company details in Settings"
    echo "  4. Set up bank accounts and start using the system"
    echo ""
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${RED}❌ docker-compose.yml not found. Are you in the ERPREACT directory?${NC}"
        exit 1
    fi

    check_docker
    check_env
    deploy_docker
    verify_deployment
    show_access_info
}

# Run main function
main
