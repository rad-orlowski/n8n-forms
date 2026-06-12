FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- runtime ----
FROM oven/bun:latest

WORKDIR /app

# Copy only what the server needs at runtime
COPY --from=builder /app/package.json /app/bun.lock* ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/server ./src/server

ENV PORT=3000

EXPOSE $PORT

CMD ["bun", "src/server/index.ts"]
