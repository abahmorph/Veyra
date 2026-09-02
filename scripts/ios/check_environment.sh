#!/usr/bin/env bash
#
# check_environment.sh - Verify the local macOS/Xcode toolchain and the
# Veyra project are ready for a VANTA iOS deployment.
#
# Prints a status summary; exits 0 when READY, 1 when ACTION REQUIRED.
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

# small state helpers -------------------------------------------------------
say()   { printf '%-26s %s\n' "$1" "$2"; }
p_ok()  { printf '\033[32m✅\033[0m\n'; }
p_warn(){ printf '\033[33m⚠️\033[0m\n'; }
p_err() { printf '\033[31m❌\033[0m\n'; }

machine=ok; cli_ok=yes

printf '%s\n' "${C_BOLD}VANTA iOS DEPLOYMENT CHECK${C_RESET}"
rule

# 1. macOS ------------------------------------------------------------------
say "macOS"    "$( [ "$(uname -s)" = "Darwin" ] && p_ok || p_err )"
[ "$(uname -s)" = "Darwin" ] || { machine=fail; cli_ok=no; }

# 2. Xcode / xcodebuild / tools ---------------------------------------------
say "Xcode" "$( command -v xcodebuild >/dev/null 2>&1 && p_ok || p_warn )"
say "xcodebuild" "$( command -v xcodebuild >/dev/null 2>&1 && p_ok || p_err )"
say "App Dev tools" "$( { command -v xcrun >/dev/null 2>&1 && command -v xcodebuild >/dev/null 2>&1; } && p_ok || p_err )"
[ "$(command -v xcodebuild >/dev/null 2>&1 && echo yes)" = "yes" ] || cli_ok=no
[ -n "${DEVELOPER_DIR:-}" ] || true

# 3. Xcode version ----------------------------------------------------------
xcode_ver="n/a"
if command -v xcodebuild >/dev/null 2>&1; then
    xcode_ver="$(xcodebuild -version 2>/dev/null | head -n1 || true)"
fi

# 4. Project & scheme -------------------------------------------------------
proj="$(detect_project_file 2>/dev/null || true)"
if [ -n "$proj" ]; then
    say "Project" "$(p_ok)"
    scheme_ok=no
    if command -v xcodebuild >/dev/null 2>&1; then
        if xcodebuild -list -project "$proj" 2>/dev/null | grep -q "Veyra"; then
            scheme_ok=yes
        fi
    fi
    say "Scheme"  "$( [ "$scheme_ok" = yes ] && p_ok || p_warn )"
else
    say "Project" "$(p_err)"
    say "Scheme"  "$(p_err)"
    cli_ok=no
    proj=""
fi

# 5. Bundle identifier ------------------------------------------------------
bundle="$(grep -m1 -E "PRODUCT_BUNDLE_IDENTIFIER = [^;]+;" \
        "$VANTA_PROJECT_DIR/Veyra.xcodeproj/project.pbxproj" 2>/dev/null \
      | sed -E 's/.*PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/\1/' | head -n1 || true)"
if [ -n "$bundle" ]; then
    say "Bundle ID" "$(p_ok) $bundle"
else
    say "Bundle ID" "$(p_err)"
    cli_ok=no
fi

# 6. Signing configuration --------------------------------------------------
# Report presence of a Development Team in the project. Automatic signing is
# enabled; a missing team is the usual reason deployment cannot be authorized.
team="$(grep -m1 -E "DEVELOPMENT_TEAM = [^;]+;" \
        "$VANTA_PROJECT_DIR/Veyra.xcodeproj/project.pbxproj" 2>/dev/null \
      | sed -E 's/.*DEVELOPMENT_TEAM = ([^;]+);/\1/' | head -n1 || true)"
if [ -n "$team" ]; then
    say "Signing config" "$(p_ok) team=$team"
else
    say "Signing config" "$(p_warn) no DEVELOPMENT_TEAM set"
fi

# 7. App Store Connect ------------------------------------------------------
asc_ok=no; asc_note=""
if [ -n "$ASC_KEY_ID" ] && [ -n "$ASC_ISSUER_ID" ] && [ -f "$ASC_PRIVATE_KEY" ]; then
    asc_ok=yes
elif [ -f "$ASC_API_KEY_DIR/private_key.p8" ] && [ -n "$ASC_KEY_ID" ] && [ -n "$ASC_ISSUER_ID" ]; then
    asc_ok=yes
else
    asc_note="API key not configured"
fi
if [ "$asc_ok" = yes ]; then
    say "App Store Connect" "$(p_ok)"
else
    say "App Store Connect" "$(p_warn) $asc_note"
fi

# 8. Enforce non-secret reporting -------------------------------------------
rule
if [ "$cli_ok" = no ]; then
    err "${C_BOLD}STATUS: ACTION REQUIRED${C_RESET}"
    err "Core toolchain or project prerequisites are missing (see ❌ above)."
    err "This set of scripts must run on macOS with Xcode installed."
    exit 1
fi

if [ "$asc_ok" = yes ] && [ -n "$team" ]; then
    ok "${C_BOLD}STATUS: READY${C_RESET}"
    echo "Xcode:      $xcode_ver"
    echo "Project:    $proj"
    exit 0
fi

warn "${C_BOLD}STATUS: ACTION REQUIRED (signing / App Store Connect not fully configured)${C_RESET}"
echo "Xcode:      $xcode_ver"
echo "Project:    $proj"
echo
echo "The build/test pipeline is ready. Before deploying to TestFlight you must:"
[ -z "$team" ]           && echo "  - Set the Apple DEVELOPMENT_TEAM (Xcode Signing & Capabilities)."
[ "$asc_ok" != yes ]     && echo "  - Configure an App Store Connect API key (SCM/issuer/private key)."
echo "See docs/TESTFLIGHT_DEPLOYMENT.md."
exit 1
