#!/usr/bin/env bash
#
# export.sh - Export an archive to an App Store .ipa using xcodebuild -exportArchive.
#
# Generates an ExportOptions.plist (method=app-store) when none exists. If a
# pre-existing ExportOptions.plist is present it is NOT overwritten.
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd "xcodebuild" "Xcode is required to export an IPA."
require_cmd "plutil"     "Xcode command line tools are required for plutil."

require_file "$VANTA_ARCHIVE_PATH" "ARCHIVE FAILURE" \
    "Run scripts/ios/archive.sh (or scripts/ios/deploy.sh) first."

mkdir -p "$VANTA_BUILD_DIR"

# --- ExportOptions.plist ----------------------------------------------------
if [ ! -f "$VANTA_EXPORT_PLIST" ]; then
    info "Generating ExportOptions.plist (app-store) at:"
    info "  $VANTA_EXPORT_PLIST"

    cat > "$VANTA_EXPORT_PLIST" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>destination</key>
    <string>export</string>
    <key>signingStyle</key>
    <string>automatic</string>
    <key>stripSwiftSymbols</key>
    <true/>
</dict>
</plist>
PLIST

    # Add the team id if the project has one, so automatic signing can resolve.
    team="$(grep -m1 -E "DEVELOPMENT_TEAM = [^;]+;" \
            "$VANTA_PROJECT_DIR/Veyra.xcodeproj/project.pbxproj" 2>/dev/null \
          | sed -E 's/.*DEVELOPMENT_TEAM = ([^;]+);/\1/' | head -n1 || true)"
    if [ -n "$team" ]; then
        /usr/libexec/PlistBuddy -c "Add :teamID string '$team'" "$VANTA_EXPORT_PLIST" >/dev/null 2>&1 || \
        /usr/libexec/PlistBuddy -c "Set :teamID '$team'" "$VANTA_EXPORT_PLIST" >/dev/null 2>&1 || true
        info "Added teamID $team to ExportOptions.plist."
    fi
else
    warn "Reusing existing ExportOptions.plist (not overwritten):"
    warn "  $VANTA_EXPORT_PLIST"
    if ! plutil -lint "$VANTA_EXPORT_PLIST" >/dev/null 2>&1; then
        die "EXPORT FAILURE" \
            "The existing ExportOptions.plist is invalid XML." \
            "  $VANTA_EXPORT_PLIST"
    fi
fi

# --- Export -----------------------------------------------------------------
info "Exporting IPA..."
info "IPA path: $VANTA_IPA_PATH"
rm -rf "$VANTA_BUILD_DIR/export"

if ! xcodebuild -exportArchive \
        -archivePath "$VANTA_ARCHIVE_PATH" \
        -exportOptionsPlist "$VANTA_EXPORT_PLIST" \
        -exportPath "$VANTA_BUILD_DIR/export" \
        -allowProvisioningUpdates 2>&1 | tee "$VANTA_BUILD_DIR/export.log" | grep -E "error:|warning:|exportArchives|IPA|exported"; then
    :
fi

if [ ! -f "$VANTA_BUILD_DIR/export/Veyra.ipa" ]; then
    reason="$(grep -m1 -E "error:" "$VANTA_BUILD_DIR/export.log" || true)"
    die "EXPORT FAILURE" \
        "IPA export failed." \
        "Reason: ${reason:-inspect '$VANTA_BUILD_DIR/export.log'}." \
        "Recommended action: verify signing/provisioning configuration (see docs)."
fi

mv "$VANTA_BUILD_DIR/export/Veyra.ipa" "$VANTA_IPA_PATH"
ok "EXPORT SUCCEEDED"
info "Archive: $VANTA_ARCHIVE_PATH"
info "IPA:     $VANTA_IPA_PATH"

# --- Report versions --------------------------------------------------------
version="$(read_marketing_version)"
build="$(read_build_number)"
info "Version: $version ($build)"
