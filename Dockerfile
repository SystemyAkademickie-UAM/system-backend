# Build stage (Node/npm versions align with docs/prerequisites.md)
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
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/constants ./src/constants
EXPOSE 8080
CMD ["sh", "-c", "npm run typeorm:migration:run:dist && exec node dist/main.js"]
