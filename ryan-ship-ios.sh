#!/usr/bin/env bash
# Build Ryan's personal Paseo iOS app ("Paseo R", com.ryanrhodes.paseo) and install it
# wirelessly on his iPad Pro 13" and iPhone Duo.
#
# Usage: ./ryan-ship-ios.sh [--sync] [--no-prebuild] [ipad|iphone|all]
#   --sync         first rebase the ryan/native-tabs-splits branch onto upstream/main
#   --no-prebuild  reuse the existing packages/app/ios project (faster; only JS changed)
set -euo pipefail
cd "$(dirname "$0")"

IPAD=00008132-0008715C0E39001C     # iPad Pro 13-inch (M4)
IPHONE=00008160-0006703E0C70000A   # iPhone Duo "ryan"
DD="$HOME/src/paseo-dd"
TEAM=GD7EU924Y9

sync=0; prebuild=1; target=all
for arg in "$@"; do
  case "$arg" in
    --sync) sync=1 ;;
    --no-prebuild) prebuild=0 ;;
    ipad|iphone|all) target=$arg ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ $sync == 1 ]]; then
  git fetch -q upstream
  git rebase upstream/main
  npm ci
fi

npm run build:app-deps
cd packages/app
if [[ $prebuild == 1 ]]; then
  APP_VARIANT=personal npx expo prebuild --platform ios --clean --non-interactive
fi

cd ios
APP_VARIANT=personal xcodebuild -workspace PaseoR.xcworkspace -scheme PaseoR -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath "$DD" -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=$TEAM CODE_SIGN_STYLE=Automatic build | tail -5

app="$DD/Build/Products/Release-iphoneos/PaseoR.app"
devices=()
[[ $target == ipad || $target == all ]] && devices+=("$IPAD")
[[ $target == iphone || $target == all ]] && devices+=("$IPHONE")
for d in "${devices[@]}"; do
  echo "Installing on $d..."
  xcrun devicectl device install app --device "$d" "$app" || echo "Install on $d failed (asleep or off the network?)" >&2
done
