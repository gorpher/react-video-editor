ARG NODE_BASE_IMAGE=node:20-bookworm-slim
FROM ${NODE_BASE_IMAGE}

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV HUSKY=0

RUN corepack enable

COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

EXPOSE 5000

CMD ["sh", "-c", "set -e; npx prisma migrate deploy; npx next start -p 5000 -H 0.0.0.0"]
