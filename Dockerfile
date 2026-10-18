FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server

ENV NODE_ENV=production
ENV KINLOOP_API_HOST=0.0.0.0
ENV KINLOOP_API_PORT=8787
ENV KINLOOP_DATA_DIR=/data

RUN mkdir -p /data/uploads

EXPOSE 8787

CMD ["node", "server/index.mjs"]
