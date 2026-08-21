# build context = this directory (packages/casino) — Coolify's default base dir works as-is
FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY package.json ./
RUN bun install --linker=hoisted
COPY . .
RUN bun run build

# run: adapter-node output under bun
FROM oven/bun:1.3.14-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
CMD ["bun", "./build/index.js"]
