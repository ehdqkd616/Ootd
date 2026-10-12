# 모노레포 루트를 빌드 컨텍스트로 사용하는 공용 Dockerfile
#   target node-service : auth / wardrobe / outfit (워크스페이스 TS 패키지를 ts-node로 실행)
#   target gateway      : Vite로 빌드한 웹 정적 파일 + API 리버스 프록시 (nginx)

FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY services/auth/package.json services/auth/
COPY services/wardrobe/package.json services/wardrobe/
COPY services/outfit/package.json services/outfit/
RUN pnpm install --frozen-lockfile

FROM deps AS node-service
COPY packages ./packages
COPY services/auth ./services/auth
COPY services/wardrobe ./services/wardrobe
COPY services/outfit ./services/outfit
RUN pnpm --filter @ootd/db exec prisma generate
ENV NODE_ENV=production \
    TS_NODE_TRANSPILE_ONLY=true
CMD ["node", "-r", "ts-node/register", "src/index.ts"]

FROM deps AS web-build
COPY packages ./packages
COPY apps/web ./apps/web
RUN pnpm --filter @ootd/web build

FROM nginx:alpine AS gateway
COPY infrastructure/nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
