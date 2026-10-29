#!/usr/bin/env bash
# Restricts the deployed service to Zenika Google accounts. Run once, after the first deploy.
# Usage: PROJECT_ID=... ./deploy/enable-iap.sh
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT_ID="${PROJECT_ID:?définissez PROJECT_ID}"
REGION=europe-west9
SERVICE=zen-cv
DOMAIN=zenika.com

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud config set project "$PROJECT_ID"

gcloud beta run services update "$SERVICE" --region "$REGION" --iap

gcloud beta services identity create --service iap.googleapis.com >/dev/null
gcloud run services add-iam-policy-binding "$SERVICE" --region "$REGION" --quiet \
  --member "serviceAccount:service-$PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com" \
  --role roles/run.invoker >/dev/null

gcloud iap web add-iam-policy-binding --quiet \
  --resource-type cloud-run --service "$SERVICE" --region "$REGION" \
  --member "domain:$DOMAIN" --role roles/iap.httpsResourceAccessor >/dev/null

echo "IAP enabled: only @$DOMAIN accounts can open:"
gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)'
