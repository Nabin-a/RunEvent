FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server

RUN npm run build && mkdir -p /app/data

ENV NODE_ENV=production
ENV SERVE_STATIC=1
ENV API_HOST=0.0.0.0
ENV API_PORT=3001

EXPOSE 3001

CMD ["npx", "tsx", "server/index.ts"]
