# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for argon2 native bindings
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install runtime dependencies (openssl required by Prisma at runtime on Alpine 3.19+)
RUN apk add --no-cache openssl python3 make g++

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Re-generate Prisma client for production
RUN npx prisma generate

# Remove build tools after Prisma generation
RUN apk del python3 make g++ && rm -rf /tmp/*

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Development (used by docker-compose)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

EXPOSE 3000

ENV NODE_ENV=development

CMD ["npm", "run", "dev"]
