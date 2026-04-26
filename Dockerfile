# Build stage (Node/npm versions align with docs/first-setup/prerequisites.md)
FROM node:24.14.1-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@11.11.0 && npm ci
COPY . .
RUN npm run build

# Runtime: listen on 8080 (matches host nginx location /api/ → proxy_pass http://localhost:8080)
FROM node:24.14.1-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY package*.json ./
RUN npm install -g npm@11.11.0 && npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/main.js"]
