# Multi-stage build for NOVA (single-service: API serves the built client).
# Build:  docker build -t nova .
# Run:    docker run -p 4000:4000 -e MONGODB_URI=... -e JWT_SECRET=... nova

# --- Stage 1: build the React client ---
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# --- Stage 2: install server production deps ---
FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --omit=dev

# --- Stage 3: runtime ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Server code + its production node_modules
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Built client, served by the Express app from ../../client/dist
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 4000
CMD ["node", "server/src/server.js"]
