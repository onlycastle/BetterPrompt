#!/bin/bash
# Generate macOS icons from logo.png
# Creates multi-resolution .icns file for Electron app

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$DESKTOP_DIR")")"

LOGO="$PROJECT_ROOT/public/images/logo.png"
ICONSET="$DESKTOP_DIR/build/icon.iconset"
OUTPUT="$DESKTOP_DIR/build/icon.icns"

# Check if source logo exists
if [ ! -f "$LOGO" ]; then
  echo "Error: Logo not found at $LOGO"
  exit 1
fi

echo "Source logo: $LOGO"
echo "Output: $OUTPUT"

# Create iconset directory
mkdir -p "$ICONSET"

# Generate all required sizes for macOS
# Standard sizes: 16, 32, 64, 128, 256, 512
# @2x sizes are double (32, 64, 128, 256, 512, 1024)
echo "Generating icon sizes..."

for size in 16 32 128 256 512; do
  sips -z $size $size "$LOGO" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  echo "  icon_${size}x${size}.png"
done

# @2x versions
for size in 16 32 128 256; do
  double=$((size * 2))
  sips -z $double $double "$LOGO" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
  echo "  icon_${size}x${size}@2x.png"
done

# 512@2x is 1024
sips -z 1024 1024 "$LOGO" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
echo "  icon_512x512@2x.png"

# Convert iconset to icns
echo "Creating .icns bundle..."
iconutil -c icns "$ICONSET" -o "$OUTPUT"

# Cleanup
rm -rf "$ICONSET"

echo "Done! Icon created at: $OUTPUT"
ls -la "$OUTPUT"
