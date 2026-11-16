#!/usr/bin/env bash
# Build "Paseo R" (APP_VARIANT=personal) for the App Store and upload it to TestFlight, so Ryan's
# devices can install it away from home. Adapted from the baby monitor's testflight.sh.
#
# Usage: ./ryan-testflight.sh [--sync] [--no-prebuild] [--local]
#   --sync         first rebase ryan/native-tabs-splits onto upstream/main
#   --no-prebuild  reuse the existing packages/app/ios project (only JS changed)
#   --local        export an .ipa to packages/app/build/testflight instead of uploading
# Uses the Apple ID signed into Xcode. Every run gets a new date-based build number.
set -euo pipefail
cd "$(dirname "$0")"

TEAM=GD7EU924Y9
BUILD=$(date +%Y%m%d%H%M)
sync=0; prebuild=1; dest=upload
for arg in "$@"; do
  case "$arg" in
    --sync) sync=1 ;;
    --no-prebuild) prebuild=0 ;;
    --local) dest=export ;;
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

OUT="$PWD/build/testflight"
mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$dest</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST

# Upstream's build number (e.g. 16000002) only changes with Paseo releases; TestFlight needs a
# new, higher one for every upload.
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD" ios/PaseoR/Info.plist

echo "== archiving Paseo R build $BUILD"
APP_VARIANT=personal xcodebuild archive -workspace ios/PaseoR.xcworkspace -scheme PaseoR \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath "$OUT/PaseoR-$BUILD.xcarchive" \
  DEVELOPMENT_TEAM=$TEAM CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates -quiet
echo "== exporting ($dest)"
xcodebuild -exportArchive -archivePath "$OUT/PaseoR-$BUILD.xcarchive" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" -exportPath "$OUT/export-$BUILD" \
  -allowProvisioningUpdates -quiet
if [[ $dest == upload ]]; then
  echo "Uploaded build $BUILD. It shows in TestFlight after Apple processes it (usually 5–30 min)."
else
  echo "Exported: $OUT/export-$BUILD"
fi
