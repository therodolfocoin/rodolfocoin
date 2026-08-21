# build the casino (bun workspace)
FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --linker=hoisted
WORKDIR /app/packages/casino
RUN bun run build

# run: adapter-node output under bun
FROM oven/bun:1.3.14-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/casino/build ./packages/casino/build
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
WORKDIR /app/packages/casino
CMD ["bun", "./build/index.js"]
