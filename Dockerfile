FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

COPY . .

RUN npm run build && npm prune --omit=dev

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=180s --retries=5 \
  CMD node -e "const http = require('http'); const port = process.env.PORT || 3001; const prefix = process.env.API_PREFIX || 'api/v1'; const options = { hostname: 'localhost', port, path: '/' + prefix + '/health', method: 'GET', timeout: 3000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.on('timeout', () => { req.destroy(); process.exit(1); }); req.end();"

ENTRYPOINT ["docker-entrypoint.sh"]
