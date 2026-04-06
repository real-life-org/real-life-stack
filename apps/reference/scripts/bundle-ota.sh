#!/usr/bin/env bash
# Creates a versioned OTA bundle zip and latest.json.
# Usage: ./scripts/bundle-ota.sh <version>
# Example: ./scripts/bundle-ota.sh 1.0.2
#
# Bundle zip  → upload to a GitHub Release (keeps git lean)
# latest.json → commit into gh-pages branch root (served at real-life-stack.de/latest.json)
#
# The bundle URL in latest.json points to the GitHub Release asset.

set -euo pipefail

VERSION="${1:?Usage: ./scripts/bundle-ota.sh <version>}"
BUNDLE_DIR="ota-bundles"
BUNDLE_FILE="bundle-${VERSION}.zip"
RELEASE_URL="https://github.com/real-life-org/real-life-stack/releases/download/ota-${VERSION}/${BUNDLE_FILE}"

mkdir -p "$BUNDLE_DIR"

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run 'pnpm build' first."
  exit 1
fi

(cd dist && zip -r "../${BUNDLE_DIR}/${BUNDLE_FILE}" .)

cat > "${BUNDLE_DIR}/latest.json" <<EOF
{
  "bundleId": "${VERSION}",
  "url": "${RELEASE_URL}"
}
EOF

echo "Bundle created: ${BUNDLE_DIR}/${BUNDLE_FILE}"
echo "latest.json:   ${BUNDLE_DIR}/latest.json"
echo ""
echo "Deploy steps:"
echo "  1. Create GitHub Release tagged 'ota-${VERSION}'"
echo "     gh release create ota-${VERSION} ${BUNDLE_DIR}/${BUNDLE_FILE} --title 'OTA ${VERSION}'"
echo "  2. Copy latest.json into gh-pages branch root and push"
echo "     → App fetches: https://real-life-stack.de/latest.json"
