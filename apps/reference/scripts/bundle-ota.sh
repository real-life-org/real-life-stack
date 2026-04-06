#!/usr/bin/env bash
# Creates a versioned OTA bundle zip from the dist/ folder.
# Usage: ./scripts/bundle-ota.sh [version]
# Example: ./scripts/bundle-ota.sh 1.0.2
#
# Output: ota-bundles/bundle-<version>.zip
#         ota-bundles/latest.json
#
# Deploy both files to your update server under the root.
# The server must serve latest.json at GET /api/latest.

set -euo pipefail

VERSION="${1:-$(date +%Y%m%d%H%M%S)}"
BUNDLE_DIR="ota-bundles"
BUNDLE_FILE="bundle-${VERSION}.zip"

mkdir -p "$BUNDLE_DIR"

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'pnpm build' first."
  exit 1
fi

(cd dist && zip -r "../${BUNDLE_DIR}/${BUNDLE_FILE}" .)

# Write latest.json — set OTA_SERVER_URL before running
SERVER_URL="${OTA_SERVER_URL:-https://real-life-stack.de}"

cat > "${BUNDLE_DIR}/latest.json" <<EOF
{
  "bundleId": "${VERSION}",
  "url": "${SERVER_URL}/${BUNDLE_FILE}"
}
EOF

echo "Bundle created: ${BUNDLE_DIR}/${BUNDLE_FILE}"
echo "latest.json:   ${BUNDLE_DIR}/latest.json"
echo ""
echo "Deploy to GitHub Pages (real-life-org/real-life-stack, gh-pages branch):"
echo "  1. Copy ${BUNDLE_DIR}/ contents into the gh-pages branch root"
echo "  2. The app fetches: ${SERVER_URL}/latest.json"
