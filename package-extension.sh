#!/usr/bin/env bash
# Packages the built extension into a .zip ready for:
#   - Chrome Web Store upload
#   - Manual install (Load unpacked → extract zip)
set -e

DIST="apps/extension/dist"
OUT="interview-caption-assistant-extension.zip"

if [ ! -d "$DIST" ]; then
  echo "❌  $DIST not found. Run: npm run build --workspace=apps/extension first."
  exit 1
fi

# Remove previous zip
rm -f "$OUT"

cd "$DIST"
zip -r "../../..$OUT" . --exclude "*.map"
cd - > /dev/null

echo "✅  Packed: $OUT"
echo ""
echo "To install manually:"
echo "  1. Unzip $OUT into a folder"
echo "  2. Go to chrome://extensions  →  enable Developer mode"
echo "  3. Click 'Load unpacked'  →  select that folder"
echo ""
echo "To publish on Chrome Web Store:"
echo "  1. Go to https://chrome.google.com/webstore/devconsole"
echo "  2. Pay the one-time \$5 developer fee (if not done)"
echo "  3. Click 'New item'  →  upload $OUT"
