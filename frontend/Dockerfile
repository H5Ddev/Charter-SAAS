# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production (nginx)
# ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config with SPA fallback routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Development
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS dev

WORKDIR /app

COPY package*.json ./

RUN npm ci

EXPOSE 5173

ENV NODE_ENV=development

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
