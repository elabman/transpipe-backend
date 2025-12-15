# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S transpipe -u 1001

# Create logs directory
RUN mkdir -p logs && chown -R transpipe:nodejs logs

# Copy application code
COPY --chown=transpipe:nodejs . .

# Switch to non-root user
USER transpipe

# Expose port
EXPOSE 5070

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5070/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]