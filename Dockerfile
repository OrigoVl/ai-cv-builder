# ---- 1. Install dependencies (pnpm workspace) + build both apps ----
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY client/ client/
COPY server/ server/
RUN pnpm --filter client build
RUN pnpm --filter server build

# ---- 2. Runtime: the Node API, serving the built client ----
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.14.0 --activate
# Unprivileged runtime user — the process shouldn't run as root.
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY server/package.json server/package.json
# --ignore-scripts: a --prod install has no devDependencies, so the root's `prepare` script
# (if any) would have nothing to run against. Nothing in the server's runtime deps needs a
# postinstall script.
RUN pnpm install --filter server --prod --frozen-lockfile --ignore-scripts
# Compiled JS — the .ts sources aren't needed at runtime.
COPY --from=build /app/server/dist /app/server/dist
# Built frontend, served from server/src/app.ts at ../../client/dist relative to dist/app.js.
COPY --from=build /app/client/dist /app/client/dist
# Generated SQL migrations — db/migrate.ts resolves this relative to its own file and runs them
# at every boot, so the container can't start the schema without this.
COPY --from=build /app/server/drizzle /app/server/drizzle
RUN chown -R app:app /app
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/server
USER app
# wget ships with busybox (alpine's default) — checks the API is alive without extra deps.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:${PORT}/api/health || exit 1
CMD ["node", "--no-warnings", "dist/index.js"]
