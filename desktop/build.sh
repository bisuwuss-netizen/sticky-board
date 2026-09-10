#!/bin/bash
# One-command rebuild: icon + bundle + resources + ad-hoc signature.
# Usage: ./build.sh   (run from repo root or desktop/)
set -eu
cd "$(dirname "$0")"

APP=TheJourney.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

[ -f Journey.icns ] || python3 make_icon.py
cp Journey.icns "$APP/Contents/Resources/Journey.icns"
cp Info.plist "$APP/Contents/Info.plist"
cp ../index.html "$APP/Contents/Resources/index.html"

MC="${TMPDIR:-/tmp}/tj-modulecache"
mkdir -p "$MC"
FW="-framework Cocoa -framework WebKit -framework ImageIO -framework UniformTypeIdentifiers"
# shellcheck disable=SC2086
swiftc -O -module-cache-path "$MC" $FW -target arm64-apple-macos12.0 main.swift \
  -o "$APP/Contents/MacOS/TheJourney.arm64"
# shellcheck disable=SC2086
swiftc -O -module-cache-path "$MC" $FW -target x86_64-apple-macos12.0 main.swift \
  -o "$APP/Contents/MacOS/TheJourney.x64"
lipo -create "$APP/Contents/MacOS/TheJourney.arm64" "$APP/Contents/MacOS/TheJourney.x64" \
  -output "$APP/Contents/MacOS/TheJourney"
rm "$APP/Contents/MacOS/TheJourney.arm64" "$APP/Contents/MacOS/TheJourney.x64"
lipo -info "$APP/Contents/MacOS/TheJourney"
codesign --force --deep -s - "$APP"
codesign --verify --verbose "$APP"
du -sh "$APP"
echo BUILD_DONE
