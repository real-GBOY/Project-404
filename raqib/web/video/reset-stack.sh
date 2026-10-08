#!/usr/bin/env bash
# Rebuilds the throw-away recording backend from a clean, freshly seeded database (backend :3399). Run from raqib/web.
export PATH="/c/nvm4w/nodejs:$PATH"
PID=$(netstat -ano | grep ":3399 " | grep LISTENING | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
cd ../backend || exit 1
RAQIB_E2E_DB=raqib_video node scripts/e2e-db.mjs || exit 1
AURIC_PORT=3399 NODE_ENV=development AURIC_DATABASE_URL="postgres://postgres:postgres@localhost:5432/raqib_video" \
 AURIC_JWT_SECRET=e2e-secret-e2e-secret-e2e-secret-123456 AURIC_APP_URL=http://localhost:4599 AURIC_FILE_STORAGE_DRIVER=local \
 AURIC_FILE_STORAGE_PATH=./storage/video AURIC_LOG_LEVEL=warn RAQIB_SEED_DEMO=true RAQIB_DEMO_HISTORY_DAYS=90 \
 RAQIB_ENFORCE_ACCOUNT_POLICY=false RAQIB_TRUSTED_PROXY_HOPS=1 nohup node --import @swc-node/register/esm-register main.ts > "${1:-/dev/null}" 2>&1 &
for i in $(seq 1 90); do curl -s -m 3 -o /dev/null -w '%{http_code}' http://localhost:3399/api/health/ready | grep -q 200 && { echo "backend ready after ~$((i*3))s"; exit 0; }; sleep 3; done
echo "backend did not become ready"; exit 1
