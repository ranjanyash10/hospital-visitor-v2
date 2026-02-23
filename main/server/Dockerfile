# --- Stage 1: Build ---
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

# Install dependencies including devDependencies (to run build scripts if any)
RUN npm install

COPY . .

# --- Stage 2: Production ---
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package.json for production install
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy source code from builder stage
COPY --from=builder /usr/src/app/src ./src

# Create a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

CMD ["node", "src/app.js"]
