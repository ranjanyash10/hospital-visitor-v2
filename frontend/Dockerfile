# --- Stage 1: Build ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Pass build-time variables for Vite
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

RUN npm run build

# Generate 404 fallback from the BUILT index.html (not the source one)
RUN cp dist/index.html dist/404.html

# --- Stage 2: Serve (Nginx) ---
FROM nginx:stable-alpine

# Copy local Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Nginx will automatically substitute env vars in templates ending in .template
CMD ["nginx", "-g", "daemon off;"]
