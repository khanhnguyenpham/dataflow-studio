FROM node:24-alpine AS frontend
WORKDIR /build
RUN npm install --global pnpm@11.25.0
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock && useradd --uid 10001 --create-home dataflow
COPY backend/ ./backend/
COPY sample_data/ ./sample_data/
COPY --from=frontend /build/dist ./frontend/dist
ENV PYTHONPATH=/app/backend PYTHONUNBUFFERED=1
USER dataflow
EXPOSE 8000
CMD ["sh", "-c", "python -m alembic -c backend/alembic.ini upgrade head && exec python -m uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000} --limit-concurrency 8"]
