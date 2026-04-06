#!/usr/bin/env bash
# Creates a versioned OTA bundle zip and latest.json for a specific channel.
# Usage: ./scripts/bundle-ota.sh <version> <channel>
# Channels: ios | android | android-foss
# Example: ./scripts/bundle-ota.sh 1.0.2 ios
#
# Bundle zip  → upload to a GitHub Release (keeps git lean)
# latest.json → commit into gh-pages branch at updates/<channel>/latest.json
#               → served at real-life-stack.de/updates/<channel>/latest.json

set -euo pipefail

VERSION="${1:?Usage: ./scripts/bundle-ota.sh <version> <channel>}"
CHANNEL="${2:?Usage: ./scripts/bundle-ota.sh <version> <channel>  (ios|android|android-foss)}"
BUNDLE_DIR="ota-bundles/${CHANNEL}"
BUNDLE_FILE="bundle-${CHANNEL}-${VERSION}.zip"
RELEASE_TAG="ota-${VERSION}"
RELEASE_URL="https://github.com/real-life-org/real-life-stack/releases/download/${RELEASE_TAG}/${BUNDLE_FILE}"

mkdir -p "$BUNDLE_DIR"

if [ ! -d "dist" ]; then
  echo "Error: dist/ not found. Run the appropriate build first:"
  echo "  ios:          VITE_UPDATE_CHANNEL=ios pnpm build"
  echo "  android:      VITE_UPDATE_CHANNEL=android pnpm build"
  echo "  android-foss: VITE_UPDATE_CHANNEL=android-foss pnpm build"
  exit 1
fi

(cd dist && zip -r "../../${BUNDLE_DIR}/${BUNDLE_FILE}" .)

cat > "${BUNDLE_DIR}/latest.json" <<EOF
{
  "bundleId": "${VERSION}",
  "url": "${RELEASE_URL}"
}
EOF

echo "Channel:  ${CHANNEL}"
echo "Bundle:   ${BUNDLE_DIR}/${BUNDLE_FILE}"
echo "Manifest: ${BUNDLE_DIR}/latest.json"
echo ""
echo "Deploy steps:"
echo "  1. Upload zip to GitHub Release:"
echo "     gh release create ${RELEASE_TAG} ${BUNDLE_DIR}/${BUNDLE_FILE} --title 'OTA ${VERSION}'"
echo "     (or append to existing release: gh release upload ${RELEASE_TAG} ${BUNDLE_DIR}/${BUNDLE_FILE})"
echo ""
echo "  2. Commit latest.json to gh-pages branch:"
echo "     Place at: updates/${CHANNEL}/latest.json"
echo "     → App fetches: https://real-life-stack.de/updates/${CHANNEL}/latest.json"
