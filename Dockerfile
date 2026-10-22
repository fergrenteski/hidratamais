# syntax=docker/dockerfile:1
# Imagem única: React buildado + API Express na porta 8080.
# Compatível com OpenShift (UID aleatório, GID 0) e com `docker run` comum.

FROM node:22-alpine AS client
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080 \
    HOME=/tmp
WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/scripts ./scripts
COPY --from=client /build/dist ./public
# OpenShift roda com UID arbitrário no grupo 0: o grupo precisa das mesmas permissões do dono.
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/index.js"]
