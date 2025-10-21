# Deploying Milo backend to Google Cloud Run

This document explains how to build, push, and deploy the backend container to Google Cloud Run. It also shows how to configure environment variables and secrets.

Prerequisites

- Google Cloud SDK (gcloud) installed and authenticated
- Docker installed and configured
- A Google Cloud project selected: `gcloud config set project YOUR_PROJECT_ID`

1. Build the container locally

```bash
# From the repository root
cd backend
# Build the image and tag it for Google Container Registry (GCR)
IMAGE_NAME=gcr.io/YOUR_PROJECT_ID/milo-backend:latest
docker build -t $IMAGE_NAME .
```

2. Push the image to GCR

```bash
# Authenticate Docker to GCR (if needed)
gcloud auth configure-docker
# Push the image
docker push $IMAGE_NAME
```

3. Deploy to Cloud Run

```bash
# Deploy to Cloud Run (fully managed)
gcloud run deploy milo-backend \
  --image $IMAGE_NAME \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --update-env-vars "OPENAI_API_KEY=projects/YOUR_PROJECT_ID/secrets/OPENAI_API_KEY:latest,GCS_BUCKET_NAME=your-gcs-bucket"
```

Notes on secrets and environment variables

- Use Secret Manager for storing sensitive values like `OPENAI_API_KEY`. The example above shows how to reference a Secret Manager secret in `--update-env-vars` using the `projects/.../secrets/...:latest` syntax if you have set up Workload Identity and Secret Manager integration. If you haven't, supply the value directly in `--update-env-vars` (not recommended for production).

Alternative: deploy with explicit env var values (less secure):

```bash
gcloud run deploy milo-backend \
  --image $IMAGE_NAME \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "OPENAI_API_KEY=sk-...,GCS_BUCKET_NAME=your-gcs-bucket"
```

4. Verify deployment

- Visit the Cloud Run URL printed by `gcloud run deploy` and check `/healthz` to ensure the service is ready.
- Check Cloud Run logs in the console or with `gcloud logs read`.

Troubleshooting

- If gunicorn workers fail, inspect Cloud Run logs for stack traces. Common causes:
  - Environment variables not provided (app may return 500s but should not crash now).
  - Permissions: ensure the Cloud Run service account has access to Firestore and Cloud Storage (roles `roles/datastore.user` and `roles/storage.objectCreator` / `roles/storage.admin` as needed).
  - Secret Manager access: ensure service account has `secretmanager.accessor` role.

Security

- Prefer Secret Manager over plain env vars for API keys.
- Use least-privilege IAM roles for the Cloud Run service account.

If you want, I can create a `cloudbuild.yaml` to automate the build+deploy step, or update the Dockerfile further.
I have included a `cloudbuild.yaml` to automate build+deploy and helper scripts in `scripts/`:

- `scripts/setup_gcp_resources.sh YOUR_PROJECT_ID YOUR_GCS_BUCKET` - creates a service account, enables APIs, and creates the GCS bucket.
- `scripts/deploy_cloudrun.sh YOUR_PROJECT_ID REGION TAG YOUR_GCS_BUCKET` - deploys the built image and wires Secret Manager secret `OPENAI_API_KEY`.
- `scripts/local_run.sh TAG OPENAI_API_KEY GCS_BUCKET` - builds and runs the container locally for testing.

Use these scripts to automate the steps in this README.
