#!/usr/bin/env bash
#
# Builds the Lambda bundle that infra/lib/app-stack.ts uploads.
#
# `next build` with output: 'standalone' leaves a server that is missing three things it
# needs in Lambda, and this adds them:
#
#   run.sh              the entry point the Lambda Web Adapter execs. The function's
#                       handler is literally "run.sh", not a JavaScript export.
#   .next/static        fingerprinted client assets
#   public              fonts and the college shield
#
# CloudFront serves the last two from S3, so Lambda would normally never be asked for
# them. They are copied in anyway: it costs about a megabyte and it means a mistake in a
# cache behaviour degrades to a slow page rather than a broken one.
#
# Run from anywhere. Every path is derived from this file's location, which matters here
# because the repository directory name ends in a space.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STANDALONE="${REPO_ROOT}/.next/standalone"

cd "${REPO_ROOT}"

echo "==> Building in ${REPO_ROOT}"
npm run build

if [ ! -d "${STANDALONE}" ]; then
  echo "error: ${STANDALONE} is missing. Is output: 'standalone' still set in next.config.mjs?" >&2
  exit 1
fi

echo "==> Verifying the catalogue release travelled with the bundle"
if [ ! -f "${STANDALONE}/data/generated/release-manifest.json" ]; then
  echo "error: no catalogue release inside the bundle." >&2
  echo "       outputFileTracingIncludes in next.config.mjs is what puts it there." >&2
  echo "       Without it every request answers 503 at /api/v1/health/ready." >&2
  exit 1
fi

echo "==> Writing the Lambda Web Adapter entry point"
cat > "${STANDALONE}/run.sh" <<'ENTRY'
#!/bin/bash
exec node server.js
ENTRY
chmod +x "${STANDALONE}/run.sh"

echo "==> Copying client assets into the bundle"
rm -rf "${STANDALONE}/.next/static" "${STANDALONE}/public"
cp -R "${REPO_ROOT}/.next/static" "${STANDALONE}/.next/static"
cp -R "${REPO_ROOT}/public" "${STANDALONE}/public"

echo "==> Bundle ready"
du -sh "${STANDALONE}"
echo "    release: $(python3 -c "import json,sys;print(json.load(open('${STANDALONE}/data/generated/release-manifest.json'))['activeReleaseId'])")"
