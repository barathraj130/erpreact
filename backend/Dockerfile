FROM node:20-alpine

WORKDIR /app

# Copy backend package files ONLY (not root package.json which has broken install script)
COPY backend/package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ .

# Create necessary directories
RUN mkdir -p uploads/signatures uploads/products uploads/reports backups logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node --eval "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

# Start application
CMD ["node", "server.js"]
