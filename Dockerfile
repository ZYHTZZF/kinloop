FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html marketing.html tsconfig*.json vite.config.ts eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV KINLOOP_API_HOST=0.0.0.0
ENV KINLOOP_API_PORT=8787
ENV KINLOOP_DATA_DIR=/data
ENV KINLOOP_CLIENT_DIST_DIR=/app/dist

RUN mkdir -p /data/uploads

EXPOSE 8787

CMD ["node", "server/index.mjs"]
