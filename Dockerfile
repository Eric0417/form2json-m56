FROM node:22-slim AS frontend

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts ./
COPY public ./public
COPY src ./src
RUN pnpm build


FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app
RUN pip install --no-cache-dir uv==0.12.23

COPY api/pyproject.toml api/uv.lock ./api/
RUN cd api && uv sync --frozen --no-dev

COPY api/app ./api/app
COPY --from=frontend /app/dist ./dist

RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

ENV PATH="/app/api/.venv/bin:$PATH"
EXPOSE 10000

CMD ["sh", "-c", "cd /app/api && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
