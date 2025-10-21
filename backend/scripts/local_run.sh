#!/usr/bin/env bash
# Local docker build and run helper
# Usage: ./local_run.sh TAG OPENAI_API_KEY GCS_BUCKET
set -euo pipefail
TAG=${1:-local}
OPENAI_KEY=${2:-}
GCS_BUCKET=${3:-}

docker build -t milo-backend:$TAG .

docker run --rm -p 8080:8080 \
  -e OPENAI_API_KEY="$OPENAI_KEY" \
  -e GCS_BUCKET_NAME="$GCS_BUCKET" \
  milo-backend:$TAG
