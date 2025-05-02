FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code and config
COPY . .

# Build the application
RUN npm run build

FROM node:18-alpine AS release

WORKDIR /app

# Copy only the necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Set production environment
ENV NODE_ENV=production

# Command will be provided by smithery.yaml
CMD ["node", "dist/index.js"]