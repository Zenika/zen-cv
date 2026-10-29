#!/usr/bin/env bash
# One-time GCP setup, before the first deploy.
# Usage: PROJECT_ID=... CLOUD_SQL_CONNECTION_NAME=project:region:instance ./deploy/setup-gcp.sh
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT_ID="zen-cv-513014"
CLOUD_SQL_CONNECTION_NAME="zen-cv-513014:europe-west9:dev-zen-cv"
REGION=europe-west9
GITHUB_REPOSITORY=zenika-dev/zen-cv
REPOSITORY=zen-cv
SECRET=zen-cv-database-url
POOL=github

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="zen-cv-run@$PROJECT_ID.iam.gserviceaccount.com"
DEPLOY_SA="zen-cv-deploy@$PROJECT_ID.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"

echo "== APIs"
gcloud services enable \
  run.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com iap.googleapis.com

echo "== Artifact Registry"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" --repository-format docker --location "$REGION"

echo "== Service accounts"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create zen-cv-run --display-name "zen-cv Cloud Run"
gcloud iam service-accounts describe "$DEPLOY_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create zen-cv-deploy --display-name "zen-cv GitHub deploy"

echo "== DATABASE_URL secret"
echo "Format : postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/$CLOUD_SQL_CONNECTION_NAME"
read -rsp "DATABASE_URL (laisser vide pour garder la valeur actuelle) : " DATABASE_URL
echo
if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
  if [ -z "$DATABASE_URL" ]; then
    echo "La première fois, DATABASE_URL est obligatoire." >&2
    exit 1
  fi
  printf '%s' "$DATABASE_URL" |
    gcloud secrets create "$SECRET" --replication-policy user-managed --locations "$REGION" --data-file -
elif [ -n "$DATABASE_URL" ]; then
  printf '%s' "$DATABASE_URL" | gcloud secrets versions add "$SECRET" --data-file -
fi

echo "== Runtime permissions"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition None --quiet \
  --member "serviceAccount:$RUNTIME_SA" --role roles/cloudsql.client >/dev/null
gcloud secrets add-iam-policy-binding "$SECRET" --quiet \
  --member "serviceAccount:$RUNTIME_SA" --role roles/secretmanager.secretAccessor >/dev/null

echo "== Deploy permissions"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --condition None --quiet \
  --member "serviceAccount:$DEPLOY_SA" --role roles/run.admin >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY" --location "$REGION" --quiet \
  --member "serviceAccount:$DEPLOY_SA" --role roles/artifactregistry.writer >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" --quiet \
  --member "serviceAccount:$DEPLOY_SA" --role roles/iam.serviceAccountUser >/dev/null

echo "== Workload Identity Federation (GitHub → GCP, no key)"
gcloud iam workload-identity-pools describe "$POOL" --location global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
gcloud iam workload-identity-pools providers describe github --location global \
  --workload-identity-pool "$POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc github --location global \
    --workload-identity-pool "$POOL" \
    --display-name "GitHub" \
    --issuer-uri https://token.actions.githubusercontent.com \
    --attribute-mapping google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref \
    --attribute-condition "assertion.repository == '$GITHUB_REPOSITORY' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" --quiet \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository/$GITHUB_REPOSITORY" >/dev/null

cat <<EOF

Done. Add these repository variables in GitHub
(Settings → Secrets and variables → Actions → Variables):

  GCP_PROJECT_ID                  $PROJECT_ID
  GCP_WORKLOAD_IDENTITY_PROVIDER  projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/providers/github
  GCP_DEPLOY_SERVICE_ACCOUNT      $DEPLOY_SA
  GCP_RUNTIME_SERVICE_ACCOUNT     $RUNTIME_SA
  CLOUD_SQL_CONNECTION_NAME       $CLOUD_SQL_CONNECTION_NAME

Then push to main (or run the workflow manually) and, once deployed, run ./deploy/enable-iap.sh.
EOF
