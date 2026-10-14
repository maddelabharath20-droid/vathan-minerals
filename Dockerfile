# Multi-stage Docker build for VATHAN MINERALS platform
FROM node:20-alpine AS build

WORKDIR /app

# Copy package manifests
COPY package.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm install --prefix backend
RUN npm install --prefix frontend

# Copy all source files
COPY . .

# Build frontend production bundle
RUN npm run build --prefix frontend

# Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy root, backend and built frontend dist
COPY package.json ./
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
COPY database ./database

EXPOSE 4000

CMD ["node", "backend/src/server.js"]
