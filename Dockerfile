FROM oven/bun:1.3-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/gateway/package.json packages/gateway/
COPY packages/brain/package.json packages/brain/

# Install deps
RUN bun install --frozen-lockfile

# Copy source
COPY packages/ packages/

EXPOSE 8890

CMD ["bun", "packages/brain/src/index.ts"]
