# Production Multi-Stage Dockerfile for FreelanceVault Backend
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm ci

# Copy source code and build
COPY src ./src/
RUN npx prisma generate
RUN npm run build

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install openssl for prisma client
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Non-root user for security
RUN mkdir -p uploads && chown -R node:node /app
USER node

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
