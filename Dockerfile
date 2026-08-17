FROM node:22-alpine AS build

WORKDIR /app
ARG VITE_PAYMENT_API_URL
ARG VITE_AI_API_URL
ENV VITE_PAYMENT_API_URL=${VITE_PAYMENT_API_URL}
ENV VITE_AI_API_URL=${VITE_AI_API_URL}
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/node-entry.js"]
