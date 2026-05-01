# 🚀 ERP System - Complete Setup & Deployment Guide

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Local Installation](#local-installation)
3. [Database Setup](#database-setup)
4. [Configuration](#configuration)
5. [Running the System](#running-the-system)
6. [Deployment](#deployment)
7. [Docker Setup](#docker-setup)
8. [Backup & Recovery](#backup--recovery)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting](#troubleshooting)

---

## System Requirements

### Minimum Requirements

- **OS**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
- **CPU**: 2 cores
- **RAM**: 4 GB
- **Storage**: 10 GB

### Recommended

- **CPU**: 4+ cores
- **RAM**: 8+ GB
- **Storage**: 50+ GB (with backups)

### Software Dependencies

- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v12.0 or higher
- **npm**: v9.0.0 or higher
- **Docker** (optional, for containerized deployment)

---

## Local Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/erpreact.git
cd ERPREACT
```

### Step 2: Install Dependencies

**Backend:**

```bash
cd backend
npm install
```

**Frontend:**

```bash
cd ../frontend
npm install
```

### Step 3: Create Environment Files

**Backend (.env):**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

**Sample .env content:**

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://erp_user:password@localhost:5432/erp_db
JWT_SECRET=your_secret_key_here_change_in_productionENCRYPTION_KEY=your_32_byte_hex_key
FRONTEND_URL=http://localhost:5173
```

---

## Database Setup

### Step 1: Create PostgreSQL Database

```bash
# Login to PostgreSQL
psql -U postgres

# Create user
CREATE USER erp_user WITH PASSWORD 'secure_password_123';

# Create database
CREATE DATABASE erp_database OWNER erp_user;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE erp_database TO erp_user;

# Exit
\q
```

### Step 2: Run Database Schema

```bash
cd backend
node database/schemaDef.js
```

This will automatically create all required tables.

### Step 3: Seed Initial Data

```bash
node database/seedPermissions.js
```

---

## Configuration

### 1. Company Setup

- Create your company in the database
- Generate unique company code
- Set subscription plan and enabled modules

### 2. User Management

- Create admin user with full permissions
- Create role-based users (Manager, Staff)
- Configure branch assignments

### 3. Chart of Accounts

Set up your financial accounts:

- Assets
- Liabilities
- Equity
- Revenue
- Expense

---

## Running the System

### Development Mode

**Start Backend:**

```bash
cd backend
npm run dev
# Server runs on http://localhost:3000
```

**Start Frontend (new terminal):**

```bash
cd frontend
npm run dev
# Client runs on http://localhost:5173
```

### Production Mode

**Build Frontend:**

```bash
cd frontend
npm run build
```

**Start Backend:**

```bash
cd backend
NODE_ENV=production npm start
```

---

## Deployment

### Option 1: Manual Server Deployment (Linux/Ubuntu)

#### Step 1: Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install PM2 (process manager)
sudo npm install -g pm2
```

#### Step 2: Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/erpreact.git /opt/erp
cd /opt/erp

# Install dependencies
cd backend && npm install
cd ../frontend && npm install && npm run build

# Create .env file
cp backend/.env.example backend/.env
# Edit backend/.env with production values
```

#### Step 3: Setup PM2

```bash
cd /opt/erp/backend

# Create PM2 config file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'erp-backend',
    script: './server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    autorestart: true,
    max_memory_restart: '1G'
  }]
};
EOF

# Start application
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Step 4: Setup Nginx Reverse Proxy

```bash
sudo apt install -y nginx

# Create Nginx config
sudo cat > /etc/nginx/sites-available/erp << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /opt/erp/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF
# Enable site
sudo ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 5: Setup SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Docker Setup

### Step 1: Build Docker Images

Create **Dockerfile** for Backend:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["node", "server.js"]
```

Create **Dockerfile** for Frontend:

```dockerfile
FROM node:18-alpine as builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Step 2: Docker Compose

Create **docker-compose.yml**:

```yaml
version: '3.8'

services:
  database:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: erp_database
      POSTGRES_USER: erp_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://erp_user:secure_password@database:5432/erp_database
      NODE_ENV: production
      JWT_SECRET: your_secret_here
    depends_on:
      - database
    volumes:
      - ./backend/uploads:/app/uploads
      - ./backend/backups:/app/backups

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

### Step 3: Run with Docker

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

---

## Backup & Recovery

### Automatic Daily Backups

The system automatically creates backups daily at 2 AM. To verify:

```bash
# Check backup API
curl -X GET http://localhost:3000/api/backups/list \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response shows list of backups with timestamps
```

### Manual Backup

```bash
# Trigger manual backup
curl -X POST http://localhost:3000/api/backups/create \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Restore from Backup

```bash
# Restore specific backup
curl -X POST http://localhost:3000/api/backups/{backup_id}/restore \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Backup Database Directly

```bash
# Full backup
pg_dump postgresql://erp_user:password@localhost:5432/erp_database > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore
psql postgresql://erp_user:password@localhost:5432/erp_database < backup_file.sql
```

---

## Security Best Practices

### 1. Environment Variables

- ✅ Store secrets in .env (never commit)
- ✅ Use different keys for dev/prod
- ✅ Rotate JWT secrets regularly
- ✅ Encrypt sensitive data at rest

### 2. Database Security

- ✅ Strong passwords for DB users
- ✅ Restrict database access to app server
- ✅ Enable SSL for database connections
- ✅ Regular backups with encryption

### 3. API Security

- ✅ JWT authentication on all routes
- ✅ Rate limiting enabled (100 req/15min)
- ✅ CORS properly configured
- ✅ SQL injection prevention (parameterized queries)

### 4. User Management

- ✅ Password hashing with bcrypt
- ✅ Account lockout after 5 failed attempts
- ✅ Audit logging for all actions
- ✅ Role-based access control (RBAC)

### 5. Network Security

- ✅ Use HTTPS in production
- ✅ Firewall rules for database
- ✅ VPN for admin access
- ✅ DDoS protection (Cloudflare)

### 6. Monitoring

```bash
# Check system health
curl http://localhost:3000/health
# Response:
# { "status": "ok", "timestamp": "...", "environment": "production" }
```

---

## Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
psql -U erp_user -d erp_database -c "SELECT 1;"

# Check .env DATABASE_URL
echo $DATABASE_URL

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm start
```

### Frontend Not Loading

```bash
# Check build
cd frontend
npm run build

# Check if backend API is accessible
curl http://localhost:3000/api/auth/me
```

### Disk Space Issues

```bash
# Check disk usage
df -h

# Clean old backups
curl -X POST http://localhost:3000/api/backups/cleanup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"keepCount": 10}'
```

### Memory Issues

```bash
# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm start

# Or in PM2
pm2 start ecosystem.config.js --update-env -- --max-old-space-size=4096
```

---

## Monitoring & Maintenance

### Daily Tasks

- ✅ Check backup completion
- ✅ Monitor disk usage
- ✅ Review error logs
- ✅ Verify API health

### Weekly Tasks

- ✅ Review audit logs
- ✅ Check user activity
- ✅ Update security patches
- ✅ Test backup restoration

### Monthly Tasks

- ✅ Database optimization (VACUUM, ANALYZE)
- ✅ Review and archive old data
- ✅ Update dependencies
- ✅ Security audit

---

## Support & Documentation

- 📚 API Documentation: `http://localhost:3000/api/docs`
- 🐛 Issue Tracker: GitHub Issues
- 💬 Community: Discord Server
- 📧 Enterprise Support: `support@erpsystem.com`

---

**Last Updated**: February 24, 2026
**Version**: 1.0.0
