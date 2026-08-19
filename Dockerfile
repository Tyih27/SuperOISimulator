FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.html .env.example ./
COPY styles ./styles
COPY src ./src
COPY shared ./shared
COPY server ./server
COPY docs ./docs
RUN chown -R node:node /app

EXPOSE 3000
USER node
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["node", "server/start.js"]
