#!/bin/bash
# Runs on the EC2 instance via SSM Run Command.
# Usage: bash deploy-server.sh <artifact-s3-key> <bucket-name>
# Example: bash deploy-server.sh deploy/abc123.tar.gz family-tree-backups-777312966064
set -euo pipefail
exec > >(logger -t family-tree-deploy -s) 2>&1

ARTIFACT_KEY="$1"
BUCKET="$2"
APP_DIR="/opt/family-tree"

echo "=== Deploy starting: $(date) ==="
echo "Artifact: s3://$BUCKET/$ARTIFACT_KEY"

# ── Download & extract ────────────────────────────────────────────────────────
aws s3 cp "s3://$BUCKET/$ARTIFACT_KEY" /tmp/deploy.tar.gz
tar -xzf /tmp/deploy.tar.gz -C "$APP_DIR"
rm -f /tmp/deploy.tar.gz

# ── Install production dependencies ──────────────────────────────────────────
cd "$APP_DIR"
npm ci -w packages/shared -w packages/backend --omit=dev --prefer-offline

# ── Prisma: generate client + run migrations ─────────────────────────────────
# prisma CLI installed globally in user data; load DB creds from .env
ENV_FILE="$APP_DIR/packages/backend/.env"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found — create it before deploying"; exit 1; }

set -a; source "$ENV_FILE"; set +a

cd "$APP_DIR/packages/backend"
npx prisma generate
npx prisma migrate deploy

# ── Restart via PM2 (run as ec2-user who owns the PM2 daemon) ────────────────
ECOSYSTEM="$APP_DIR/packages/backend/ecosystem.config.cjs"
runuser -l ec2-user -c "pm2 restart $ECOSYSTEM --update-env 2>/dev/null || pm2 start $ECOSYSTEM"
runuser -l ec2-user -c "pm2 save"

echo "=== Deploy complete: $(date) ==="
