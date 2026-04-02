FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

# Create persistent data directory
RUN mkdir -p /app/data/pdf-cache /app/data/uploads

ENV NODE_ENV=production
ENV PORT=5000
ENV DATA_DIR=/app/data

VOLUME ["/app/data"]

EXPOSE 5000

CMD ["node", "dist/index.cjs"]
