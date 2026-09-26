# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 DOCKER_BUILD=1
RUN npm install --global pnpm@11.24.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY next.config.ts tsconfig.json next-env.d.ts postcss.config.mjs ./
COPY src ./src
RUN pnpm build

FROM python:3.13-slim-bookworm AS python-build
WORKDIR /app
ENV UV_PYTHON_DOWNLOADS=never UV_LINK_MODE=copy
RUN pip install --no-cache-dir uv==0.9.4
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

FROM python:3.13-slim-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 PORT=3000 DATA_DIR=/app/data \
    PYTHON=/app/.venv/bin/python PYTHONUTF8=1 PYTHONDONTWRITEBYTECODE=1
COPY --from=web-build /usr/local/bin/node /usr/local/bin/node
COPY --from=web-build /app/.next/standalone ./
COPY --from=web-build /app/.next/static ./.next/static
COPY --from=python-build /app/.venv ./.venv
COPY pipeline ./pipeline
COPY config.json ./config.json
COPY scripts/docker-init.mjs scripts/docker-entrypoint.sh ./scripts/
RUN groupadd --gid 10001 interview && useradd --uid 10001 --gid interview --no-create-home interview \
    && mkdir -p /app/data && chown interview:interview /app/data
USER interview
EXPOSE 3000
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
