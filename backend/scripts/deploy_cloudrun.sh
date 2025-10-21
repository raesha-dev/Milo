#!/usr/bin/env bash
# Usage: ./deploy_cloudrun.sh YOUR_PROJECT_ID REGION TAG GCS_BUCKET
set -euo pipefail
PROJECT_ID=${1:-}
REGION=${2:-us-central1}
TAG=${3:-latest}
GCS_BUCKET=${4:-}
if [[ -z "$PROJECT_ID" || -z "$GCS_BUCKET" ]]; then
  echo "Usage: $0 YOUR_PROJECT_ID REGION TAG GCS_BUCKET"
  exit 1
fi
IMAGE=gcr.io/$PROJECT_ID/milo-backend:$TAG

echo "Deploying $IMAGE to Cloud Run in $REGION"

gcloud run deploy milo-backend \
  --image $IMAGE \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "GCS_BUCKET_NAME=$GCS_BUCKET" \
  --set-secrets "OPENAI_API_KEY=OPENAI_API_KEY:latest" \
  --service-account "milo-backend-sa@$PROJECT_ID.iam.gserviceaccount.com"

echo "Deployment finished. Use gcloud run services describe milo-backend --platform managed --region $REGION to get URL."
