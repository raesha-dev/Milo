# Base image and working dir
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies (include curl for healthchecks and ca-certificates)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    libffi-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies (make sure gunicorn is in requirements.txt)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Expose Cloud Run port and set env for predictable behavior
ENV PORT=8080
EXPOSE 8080

# Healthcheck: use the /healthz endpoint we've added in app.py
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -fsS http://localhost:8080/healthz || exit 1

# Run gunicorn (Cloud Run routes traffic to port 8080)
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--threads", "8", "app:app"]
