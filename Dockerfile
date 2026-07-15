# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy dependency manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy source code and files needed for build
COPY src/ ./src/
COPY bin/ ./bin/

# Build TypeScript to JavaScript (dist/)
RUN npm run build

# ─── Production Stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

# Install git, which is required for history scanning in bilt
RUN apk add --no-cache git

WORKDIR /app

# Copy built code and dependency manifests
COPY package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/bin ./bin

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Make sure CLI script is executable
RUN chmod +x ./bin/bilt.js

# Create global symlink for bilt CLI so it's directly executable in the PATH
RUN npm link

# Default workspace directory for scanning
WORKDIR /workspace

# Run bilt scan by default on /workspace
ENTRYPOINT ["bilt"]
CMD ["scan"]
