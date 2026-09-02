#!/usr/bin/env bash
#
# deploy.sh - Full VANTA TestFlight deployment pipeline.
#
#   CHECK -> TEST -> SIGNING GATE -> ARCHIVE (signed) -> EXPORT IPA -> UPLOAD -> REPORT
#
# Final signing/distribution authorization is always gated on explicit human
# approval (or VANTA_SIGN=yes for non-interactive, trusted automation).
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

project="$(detect_project_file)"
[ -n "$project" ] || die "ENVIRONMENT FAILURE" "No .xcodeproj/.xcworkspace found under $VANTA_PROJECT_DIR."

version="$(read_marketing_version)"
build="$(read_build_number)"

info ""
info "${C_BOLD}🚀 VANTA TESTFLIGHT DEPLOYMENT${C_RESET}"
info "App: Veyra   Version: $version   Build: $build"
rule

# 1. CHECK -------------------------------------------------------------------
info "Step 1/6: Checking environment"
if ! "$SCRIPT_DIR/check_environment.sh" >/dev/null 2>&1; then
    # Re-run so the human sees the actionable summary.
    "$SCRIPT_DIR/check_environment.sh" || true
    warn "Environment check reported issues (see above). Proceeding checks signing gate."
fi
ok "Environment checked."

# 2. TEST --------------------------------------------------------------------
info "Step 2/6: Building and running tests"
"$SCRIPT_DIR/test.sh"
ok "Tests passed."

# 3. SIGNING AUTHORIZATION GATE ----------------------------------------------
info "Step 3/6: Signing authorization"
team="$(grep -m1 -E "DEVELOPMENT_TEAM = [^;]+;" \
        "$VANTA_PROJECT_DIR/Veyra.xcodeproj/project.pbxproj" 2>/dev/null \
      | sed -E 's/.*DEVELOPMENT_TEAM = ([^;]+);/\1/' | head -n1 || true)"

if [ -z "$team" ]; then
    err ""
    err "${C_BOLD}🔐 SIGNING AUTHORIZATION REQUIRED${C_RESET}"
    err ""
    err "The build is ready."
    err ""
    err "Required:"
    err "  - Apple Developer signing access (a Development Team is not set)"
    err "  - Distribution signing capability"
    err "  - Appropriate provisioning configuration"
    err ""
    err "No credentials were modified or exposed."
    err "Authorize signing before continuing: set a DEVELOPMENT_TEAM in Xcode."
    die "SIGNING FAILURE" \
        "Deployment stopped at the signing gate." \
        "Open Xcode -> target 'Veyra' -> Signing & Capabilities -> select your team,"
        "or set the DEVELOPMENT_TEAM build setting in the pbxproj."
fi

if [ "${VANTA_SIGN:-ask}" = "yes" ]; then
    ok "Signing pre-authorized (VANTA_SIGN=yes)."
elif [ "${VANTA_SIGN:-ask}" = "ask" ]; then
    printf '\nSigning authorization detected (team=%s).\nContinue with signing and distribution?\n' "$team"
    if confirm ""; then
        ok "Authorization granted."
    else
        warn "Authorization declined. Deployment stopped. Nothing was uploaded."
        exit 1
    fi
else
    die "SIGNING FAILURE" "Unexpected VANTA_SIGN value '$VANTA_SIGN'. Use 'ask' or 'yes'."
fi

# 4. ARCHIVE (signed) ----------------------------------------------------------
info "Step 4/6: Creating signed archive"
VANTA_SIGN=yes "$SCRIPT_DIR/archive.sh"
ok "Archive created."

# 5. EXPORT IPA ----------------------------------------------------------------
info "Step 5/6: Exporting IPA"
"$SCRIPT_DIR/export.sh"
ok "IPA exported."

# 6. UPLOAD + REPORT ------------------------------------------------------------
info "Step 6/6: Uploading to App Store Connect"
"$SCRIPT_DIR/upload_testflight.sh"

report() {
    local state="$1" name="$2" marker
    case "$state" in
        yes) marker="✅" ;;
        pending) marker="⏳" ;;
        *) marker="❌" ;;
    esac
    printf '%-10s %s\n' "$name" "$marker"
}

rule
info "${C_BOLD}🚀 TESTFLIGHT DEPLOYMENT — RESULT${C_RESET}"
info "App: Veyra   Version: $version   Build: $build"
rule
report yes   "Tests"
report yes   "Archive"
report yes   "Signing"
report yes   "IPA"
report pending "Upload"
report pending "Processing"
rule
ok "UPLOAD COMPLETE — APPLE PROCESSING PENDING"
warn "Do NOT claim the build is in TestFlight yet; wait for Apple processing."
