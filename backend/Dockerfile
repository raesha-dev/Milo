# Base image and working dir
FROM python:3.12-slim
WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt .

# Install system dependencies (include curl for healthchecks and ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libffi-dev curl ca-certificates \
 && pip install --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt \
 && apt-get purge -y build-essential gcc libffi-dev \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# Copy app code
COPY . .

# Expose Cloud Run port and set env for predictable behavior
ENV PORT=8080
EXPOSE 8080

# Healthcheck: use the /healthz endpoint we've added in app.py
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost:8080/healthz || exit 1

# Run gunicorn (Cloud Run routes traffic to port 8080)
## Run gunicorn. Increase timeout to accommodate slower startup/initialization in Cloud Run
## and reduce workers to conserve memory on small instances during initial deployment.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "120", "--graceful-timeout", "120", "app:app"]
