#!/usr/bin/env bash
# Lets the app read users' full names from the Google Workspace directory. Run once.
# The last step needs a Workspace super admin, in the Admin console.
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

PROJECT_ID="zen-cv-513014"
RUNTIME_SA="zen-cv-run@$PROJECT_ID.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID"

gcloud services enable admin.googleapis.com

cat <<MESSAGE
Last step, for a Google Workspace super admin, in admin.google.com:
  1. Account > Admin roles > Create new role, e.g. "zen-cv - lecture de l'annuaire",
     with only: Admin API privileges > Users > Read.
  2. Open that role > Admins assigned > Assign service accounts, and enter:
       $RUNTIME_SA
MESSAGE
