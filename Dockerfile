FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=8000

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/src ./src
COPY frontend ./frontend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["node", "src/server.js"]
