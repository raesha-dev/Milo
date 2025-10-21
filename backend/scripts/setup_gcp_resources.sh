#!/usr/bin/env bash
# Usage: ./setup_gcp_resources.sh YOUR_PROJECT_ID YOUR_GCS_BUCKET_NAME
set -euo pipefail
PROJECT_ID=${1:-}
GCS_BUCKET=${2:-}
if [[ -z "$PROJECT_ID" || -z "$GCS_BUCKET" ]]; then
  echo "Usage: $0 YOUR_PROJECT_ID YOUR_GCS_BUCKET_NAME"
  exit 1
fi

# Enable required APIs
gcloud services enable run.googleapis.com secretmanager.googleapis.com storage.googleapis.com firestore.googleapis.com

# Create a service account for Cloud Run
SA_NAME=milo-backend-sa
gcloud iam service-accounts create $SA_NAME --project=$PROJECT_ID --display-name="Milo Backend Service Account"

# Grant roles: Firestore user, Storage object admin (or more restricted), Secret Manager accessor
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/datastore.user"

# Storage role
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"

# Secret Manager role
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"

# Create Firestore DB (if not exists) - this prompts for region for first time
# gcloud alpha firestore databases create --project=$PROJECT_ID --region=us-central

# Create or ensure GCS bucket exists
if ! gsutil ls -b gs://$GCS_BUCKET >/dev/null 2>&1; then
  gsutil mb -p $PROJECT_ID -l us-central1 gs://$GCS_BUCKET
  echo "Created bucket gs://$GCS_BUCKET"
else
  echo "Bucket gs://$GCS_BUCKET already exists"
fi

echo "Service account: ${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Next: create a secret for OPENAI_API_KEY with Secret Manager, then deploy using the cloudbuild.yaml or gcloud run deploy."
