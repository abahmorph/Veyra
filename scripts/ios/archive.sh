#!/usr/bin/env bash
#
# archive.sh - Create an .xcarchive in a predictable build directory.
#
# Signing behavior:
#   * Standalone (CI / local build without credentials): produces an UNSIGNED
#     archive (CODE_SIGNING_ALLOWED=NO). Good for verifying the build.
#   * When run via deploy.sh, VANTA_SIGN=yes is set AFTER the human
#     authorization gate, so the archive is signed with the team's automatic
#     App Store distribution signing for TestFlight export.
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd "xcodebuild" "Xcode is required to archive."
[ -e "$VANTA_PROJECT_FILE" ] || die "ENVIRONMENT FAILURE" \
    "Project not found: $VANTA_PROJECT_FILE"

mkdir -p "$VANTA_BUILD_DIR"
rm -rf "$VANTA_ARCHIVE_PATH"

info "Archiving scheme '$VANTA_SCHEME' ($VANTA_RELEASE_CONFIG)..."
info "Archive path: $VANTA_ARCHIVE_PATH"

sign_args=()
if [ "${VANTA_SIGN:-no}" = "yes" ]; then
    ok "Signing ENABLED (authorization granted) - using automatic distribution signing."
    DEST="$(generic_device_destination)"
else
    warn "Signing DISABLED - producing an unsigned archive (CI/local build only)."
    sign_args=(CODE_SIGNING_ALLOWED=NO CODE_SIGN_IDENTITY="" PROVISIONING_PROFILE_SPECIFIER="")
    DEST="$(generic_device_destination)"
fi

if ! xcodebuild archive \
        -project "$VANTA_PROJECT_FILE" \
        -scheme "$VANTA_SCHEME" \
        -configuration "$VANTA_RELEASE_CONFIG" \
        -destination "$DEST" \
        -archivePath "$VANTA_ARCHIVE_PATH" \
        "${sign_args[@]}" 2>&1 | tee "$VANTA_BUILD_DIR/archive.log" | grep -E "error:|warning:|ARCHIVE"; then
    :
fi

if ! grep -q "ARCHIVE SUCCEEDED" "$VANTA_BUILD_DIR/archive.log"; then
    # Extract the precise reason from xcodebuild if present.
    reason="$(grep -m1 -E "error:" "$VANTA_BUILD_DIR/archive.log" || true)"
    die "ARCHIVE FAILURE" \
        "The archive step failed." \
        "Reason: ${reason:-inspect '$VANTA_BUILD_DIR/archive.log'}." \
        "Recommended action: fix the reported error (e.g. signing/profile mismatch)."
fi

if [ ! -d "$VANTA_ARCHIVE_PATH" ]; then
    die "ARCHIVE FAILURE" \
        "xcodebuild reported success but no archive was produced at:" \
        "  $VANTA_ARCHIVE_PATH"
fi

ok "ARCHIVE SUCCEEDED"
info "Archive: $VANTA_ARCHIVE_PATH"
