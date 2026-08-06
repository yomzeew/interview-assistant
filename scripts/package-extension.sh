#!/usr/bin/env bash
# Builds the extension and creates a Chrome Web Store ZIP.
# Usage: bash scripts/package-extension.sh [version]
set -euo pipefail

VERSION="${1:-$(node -p "require('./apps/extension/manifest.json').version")}"
OUT="dist/interview-caption-assistant-v${VERSION}.zip"

echo "▶ Building extension v${VERSION}…"
npm run build --workspace=apps/extension

echo "▶ Packaging ${OUT}…"
mkdir -p dist
cd apps/extension/dist
zip -r "../../../${OUT}" . --exclude "*.map"
cd ../../..

echo "✅ Created ${OUT}"
echo ""
echo "Next steps for Chrome Web Store submission:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Pay the one-time \$5 developer registration fee (if not already done)"
echo "  3. Click 'New item' and upload ${OUT}"
echo "  4. Fill in the store listing (see docs/store-listing.md)"
echo "  5. Add at least 1 screenshot (1280×800 or 640×400)"
echo "  6. Submit for review (typically 1–3 business days)"
