#!/bin/bash
# Build and sign release for updater
# Usage: ./scripts/build-release.sh

set -e

echo "Building Spring release..."

# Build the app
cd src-tauri
cargo tauri build

# Get version from tauri.conf.json
VERSION=$(grep '"version"' tauri.conf.json | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
echo "Version: $VERSION"

# Create latest.json for updater
cat > ../latest.json <<EOF
{
  "version": "v$VERSION",
  "notes": "See GitHub releases for details",
  "pub_date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "platforms": {
    "darwin-x86_64": {
      "signature": "",
      "url": "https://github.com/mattiasmicu/Argon/releases/download/v$VERSION/Spring_$VERSION_x64.dmg"
    },
    "darwin-aarch64": {
      "signature": "",
      "url": "https://github.com/mattiasmicu/Argon/releases/download/v$VERSION/Spring_$VERSION_aarch64.dmg"
    }
  }
}
EOF

echo "Created latest.json"
echo ""
echo "To sign the update, you need to:"
echo "1. Build the app: cargo tauri build"
echo "2. Sign the DMG: gpg --detach-sign --armor target/release/bundle/dmg/*.dmg"
echo "3. Put signature in latest.json"
echo ""
echo "For now, updater checks work but auto-install requires proper signing setup."
