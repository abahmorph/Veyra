#!/usr/bin/env bash
#
# upload_testflight.sh - Upload an already-signed .ipa to App Store Connect
# for TestFlight distribution using the App Store Connect API key.
#
# This is a SEPARATE step from signing (defense in depth). It never prints
# credentials. Returns:
#   0 - upload accepted by Apple
#   1 - failure (missing config, upload error, auth error)
#
# Authentication (all secret, never committed):
#   ASC_KEY_ID      - API key ID (e.g. ABC1234567)
#   ASC_ISSUER_ID   - API issuer id (UUID)
#   ASC_PRIVATE_KEY - path to the .p8 private key
#                     (default: ~/.appstoreconnect/private_key.p8)
#
# Apple commands used (from the installed Xcode toolchain):
#   xcrun altool --upload-app -f <ipa> -t ios \
#       --apiKey <ASC_KEY_ID> --apiIssuer <ASC_ISSUER_ID>
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd "xcrun" "Xcode command line tools are required for upload."

require_file "$VANTA_IPA_PATH" "UPLOAD FAILURE" \
    "No IPA found. Run scripts/ios/deploy.sh or scripts/ios/export.sh first."

# --- Credential resolution (never echoed) -----------------------------------
if [ -z "$ASC_KEY_ID" ] || [ -z "$ASC_ISSUER_ID" ]; then
    die "UPLOAD FAILURE" \
        "App Store Connect API credentials are not fully configured." \
        "Required environment variables: ASC_KEY_ID and ASC_ISSUER_ID." \
        "The private key .p8 lives at $ASC_PRIVATE_KEY (not in git)." \
        "See docs/TESTFLIGHT_DEPLOYMENT.md."
fi

if [ ! -f "$ASC_PRIVATE_KEY" ]; then
    die "UPLOAD FAILURE" \
        "Private key not found at: $ASC_PRIVATE_KEY" \
        "Place the App Store Connect API .p8 there (chmod 600) or set ASC_PRIVATE_KEY."
fi

# Guard against any accidental world-readable key.
if [ -f "$ASC_PRIVATE_KEY" ] && [ -n "$(find "$ASC_PRIVATE_KEY" -maxdepth 0 -perm /022 2>/dev/null)" ]; then
    warn "Private key permissions are too open; fixing to 600."
    chmod 600 "$ASC_PRIVATE_KEY" 2>/dev/null || true
fi

version="$(read_marketing_version)"
build="$(read_build_number)"
info "Uploading Veyra $version ($build) to App Store Connect..."
info "IPA:  $VANTA_IPA_PATH"

# --- Upload -------------------------------------------------------------------
# --apiKey/--apiIssuer use the matching AuthKey_<ID>.p8 from the default key
# dir; we copy/link the configured key there so altool can find it by ID.
ALT_KEY="$ASC_API_KEY_DIR/AuthKey_$ASC_KEY_ID.p8"
if [ ! -f "$ALT_KEY" ] && [ -f "$ASC_PRIVATE_KEY" ]; then
    mkdir -p "$ASC_API_KEY_DIR"
    cp "$ASC_PRIVATE_KEY" "$ALT_KEY" 2>/dev/null || true
    chmod 600 "$ALT_KEY" 2>/dev/null || true
fi

# Run from the key dir so altool auto-discovers AuthKey_<ID>.p8.
# We do NOT print --apiKey/--apiIssuer values.
cd "$ASC_API_KEY_DIR"
if ! xcrun altool --upload-app -f "$VANTA_IPA_PATH" -t ios \
        --apiKey "$ASC_KEY_ID" \
        --apiIssuer "$ASC_ISSUER_ID" 2>&1 | tee "$VANTA_BUILD_DIR/upload.log"; then
    reason="$(grep -iE "error|invalid|unauthor|could not|failed" "$VANTA_BUILD_DIR/upload.log" | head -n1 || true)"
    die "UPLOAD FAILURE" \
        "App Store Connect rejected the upload." \
        "Reason: ${reason:-see '$VANTA_BUILD_DIR/upload.log'}." \
        "Recommended action: confirm the ASC key has App Manager permission and the bundle id/version exist in App Store Connect."
fi

# altool prints an acceptance line when the upload is accepted.
if ! grep -qiE "No errors uploading|Tool completed|upload.*success|: accepted" "$VANTA_BUILD_DIR/upload.log"; then
    if grep -qiE "error|fail" "$VANTA_BUILD_DIR/upload.log"; then
        reason="$(grep -iE "error|fail" "$VANTA_BUILD_DIR/upload.log" | head -n1 || true)"
        die "UPLOAD FAILURE" "Reason: ${reason:-see '$VANTA_BUILD_DIR/upload.log'}."
    fi
fi

ok "UPLOAD ACCEPTED — Apple processing the build."

# --- Processing status --------------------------------------------------------
# altool accepts the binary and returns immediately; Apple then processes it.
# We currently cannot poll App Store Connect for the per-build processing state
# without additional API key scopes, so we state the true status explicitly.
warn "UPLOAD COMPLETE — APPLE PROCESSING PENDING"
warn "The build has been accepted by App Store Connect but is NOT yet available"
warn "in TestFlight. Watch App Store Connect for processing to finish (a few"
warn "minutes normally). Do not claim the build is live until it shows Ready."
