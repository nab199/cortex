# Build stage
FROM node:24-slim AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:24-slim

WORKDIR /app

# Copy built assets and backend
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.ts ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/.env.example ./.env

# tsx is used to run the server.ts directly in this hybrid setup
RUN npm install -g tsx

# Create logs directory
RUN mkdir -p logs

# Expose the API port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the server
CMD ["tsx", "server.ts"]
