FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts privos-app.json SCOPES.md ./
COPY public ./public
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/privos-app.json ./privos-app.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/src/app-icon.ts /app/src/manifest.ts /app/src/mcp-message-handlers.ts /app/src/relay-transport.ts /app/src/server.ts ./src/
COPY --from=build --chown=node:node /app/src/composition ./src/composition
COPY --from=build --chown=node:node /app/src/config ./src/config
COPY --from=build --chown=node:node /app/src/email-history ./src/email-history
COPY --from=build --chown=node:node /app/src/mcp ./src/mcp
COPY --from=build --chown=node:node /app/src/payroll ./src/payroll
COPY --from=build --chown=node:node /app/src/platform ./src/platform
COPY --from=build --chown=node:node /app/src/runtime ./src/runtime
COPY --from=build --chown=node:node /app/src/services ./src/services
COPY --from=build --chown=node:node /app/src/utils ./src/utils
ARG PRIVOS_MCP_MANIFEST_JSON
ARG PRIVOS_MCP_MANIFEST_DIGEST
RUN test -n "${PRIVOS_MCP_MANIFEST_JSON}" \
    && test -n "${PRIVOS_MCP_MANIFEST_DIGEST}"
LABEL io.privos.mcp.manifest="${PRIVOS_MCP_MANIFEST_JSON}" \
      io.privos.mcp.manifest-digest="${PRIVOS_MCP_MANIFEST_DIGEST}"
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT}/ready" >/dev/null || exit 1
CMD ["node_modules/.bin/tsx", "src/server.ts"]
