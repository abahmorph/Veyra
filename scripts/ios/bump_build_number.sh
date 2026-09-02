#!/usr/bin/env bash
#
# bump_build_number.sh - Increment the build number (CURRENT_PROJECT_VERSION)
# by exactly 1. Never decreases. Does NOT change the marketing version.
#
# Usage:
#   ./scripts/ios/bump_build_number.sh            # show current + next, do nothing
#   ./scripts/ios/bump_build_number.sh --commit   # apply the next build number
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd "xcrun" "Xcode command line tools are required for agvtool (invoked via xcrun)."
[ -f "/usr/libexec/PlistBuddy" ] || die "ENVIRONMENT FAILURE" "PlistBuddy was not found; this script must run on macOS with Xcode."

cd "$VANTA_PROJECT_DIR"

version="$(read_marketing_version)"
current="$(read_build_number)"

if ! [[ "$current" =~ ^[0-9]+$ ]]; then
    die "BUILD NUMBER FAILURE" \
        "Current build number '$current' is not a positive integer." \
        "Fix CURRENT_PROJECT_VERSION in the pbxproj before incrementing."
fi

next=$((current + 1))

info "Current version/build:"
info "  Marketing version: $version"
info "  Build:             $current"
info "Next build:"
info "  $version ($next)"

if [ "${1:-}" = "--commit" ]; then
    info "Applying next build number ($next)..."
    if ! xcrun agvtool new-version -all "$next" 2>&1 | tee "$VANTA_BUILD_DIR/agvtool.log"; then
        die "BUILD NUMBER FAILURE" \
            "agvtool could not update the build number." \
            "Reason: inspect '$VANTA_BUILD_DIR/agvtool.log'."
    fi
    # Verify round-trip (safety: never silently lower the build).
    after="$(read_build_number)"
    if [ "$after" -le "$current" ]; then
        die "BUILD NUMBER FAILURE" \
            "Refusing: build number did not increase ($current -> $after)."
    fi
    ok "Build number set to $after."
else
    warn "Dry run — nothing changed. Re-run with --commit to apply."
fi
