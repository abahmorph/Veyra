#!/usr/bin/env bash
#
# lib.sh - Shared helpers for the VANTA iOS deployment engine.
# This file is sourced (not executed) by the other scripts.
#
# Everything is environment-driven so nothing secret is stored in the repo.
# See docs/TESTFLIGHT_DEPLOYMENT.md for configuration.
#

# --- Fail loudly if ANY unset variable or a sub-command fails ------------
set -euo pipefail

# --- Resolve repository root (scripts/ios/lib.sh -> repo root) -----------
VANTA_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VANTA_ROOT="$(cd "$VANTA_LIB_DIR/../.." && pwd)"

# --- Configurable paths (env overridable, safe defaults) ------------------
VANTA_PROJECT_DIR="${VANTA_PROJECT_DIR:-$VANTA_ROOT/VeyraApp}"
VANTA_PROJECT_FILE="${VANTA_PROJECT_FILE:-$VANTA_PROJECT_DIR/Veyra.xcodeproj}"
VANTA_SCHEME="${VANTA_SCHEME:-Veyra}"
VANTA_BUILD_DIR="${VANTA_BUILD_DIR:-$VANTA_PROJECT_DIR/build}"
VANTA_ARCHIVE_PATH="${VANTA_ARCHIVE_PATH:-$VANTA_BUILD_DIR/Veyra.xcarchive}"
VANTA_EXPORT_PLIST="${VANTA_EXPORT_PLIST:-$VANTA_BUILD_DIR/ExportOptions.plist}"
VANTA_IPA_PATH="${VANTA_IPA_PATH:-$VANTA_BUILD_DIR/Veyra.ipa}"
VANTA_RELEASE_CONFIG="${VANTA_RELEASE_CONFIG:-Release}"
VANTA_TEST_CONFIG="${VANTA_TEST_CONFIG:-Debug}"

# --- App Store Connect (App) API key config ------------------------------
# Secrets are read from the environment or from ~/.appstoreconnect/private_key.p8.
ASC_KEY_ID="${ASC_KEY_ID:-}"
ASC_ISSUER_ID="${ASC_ISSUER_ID:-}"
ASC_PRIVATE_KEY="${ASC_PRIVATE_KEY:-$HOME/.appstoreconnect/private_key.p8}"
ASC_API_KEY_DIR="${ASC_API_KEY_DIR:-$HOME/.appstoreconnect}"

# --- Colors / helpers (no-op when not a TTY) ------------------------------
if [ -t 1 ]; then
    C_RESET=$'\033[0m'
    C_BOLD=$'\033[1m'
    C_RED=$'\033[31m'
    C_GREEN=$'\033[32m'
    C_YELLOW=$'\033[33m'
    C_BLUE=$'\033[34m'
    C_CYAN=$'\033[36m'
else
    C_RESET=''; C_BOLD=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_CYAN=''
fi

log()    { printf '%s\n' "${C_BLUE}${1}${C_RESET}"; }
info()   { printf '%s\n' "${C_CYAN}${1}${C_RESET}"; }
ok()     { printf '%s\n' "${C_GREEN}${1}${C_RESET}"; }
warn()   { printf '%s\n' "${C_YELLOW}${1}${C_RESET}" >&2; }
err()    { printf '%s\n' "${C_RED}${1}${C_RESET}" >&2; }
rule()   { printf '%s\n' "────────────────────────────────────────────"; }

# die <category> <message ...>  -> prints a human-readable error and exits 1
die() {
    local category="$1"; shift
    err ""
    err "${C_BOLD}❌ ${category}${C_RESET}"
    err ""
    for line in "$@"; do
        err "  $line"
    done
    err ""
    exit 1
}

# require_cmd <name> <hint>
require_cmd() {
    local name="$1" hint="${2:-}"
    if ! command -v "$name" >/dev/null 2>&1; then
        die "ENVIRONMENT FAILURE" \
            "Required command '$name' was not found on PATH." \
            "${hint:-Install it and re-run.}"
    fi
}

# require_file <path> <category> <hint>
require_file() {
    local path="$1" category="$2" hint="$3"
    if [ ! -e "$path" ]; then
        die "$category" "Expected file not found: $path" "$hint"
    fi
}

# confirm <prompt> -> returns 0 if user answers yes, 1 otherwise
confirm() {
    local answer
    printf '%s [Y]es / [N]o: ' "$1"
    read -r answer
    case "${answer,,}" in
        y|yes) return 0 ;;
        *) return 1 ;;
    esac
}

# --- Project detection ----------------------------------------------------
# Returns the path to the .xcodeproj (or .xcworkspace) under the project dir.
detect_project_file() {
    local cand
    for cand in "$VANTA_PROJECT_DIR"/*.xcworkspace "$VANTA_PROJECT_DIR"/*.xcodeproj; do
        if [ -e "$cand" ]; then
            printf '%s\n' "$cand"
            return 0
        fi
    done
    return 1
}

# xcodebuild_flag <file> -> prints the -project/-workspace flag for detection
xcodebuild_flag() {
    case "$1" in
        *.xcworkspace) printf '%s\n' "-workspace $1" ;;
        *)             printf '%s\n' "-project $1" ;;
    esac
}

# --- Simulator destination detection -------------------------------------
# Picks an installed, bootable simulator. Returns e.g. platform=iOS Simulator,name=X,OS=Y
# Falls back to 'generic/platform=iOS Simulator' only if nothing concrete matches.
detect_simulator_destination() {
    require_cmd "xcrun" "Xcode command line tools are required."

    # Prefer an explicit destination from the env if provided and valid.
    if [ -n "${VANTA_SIMULATOR:-}" ]; then
        if xcrun simctl list devices available 2>/dev/null \
             | grep -Eqi "$(echo "$VANTA_SIMULATOR" | tr -d '"')"; then
            printf 'platform=iOS Simulator,%s\n' "${VANTA_SIMULATOR#platform=iOS Simulator,}"
            return 0
        fi
        warn "VANTA_SIMULATOR='$VANTA_SIMULATOR' did not match an available device; auto-detecting."
    fi

    # Derive from xcodebuild's available destinations, most specific first.
    local dests
    dests="$(xcodebuild -project "$VANTA_PROJECT_FILE" -scheme "$VANTA_SCHEME" \
             -showdestinations 2>/dev/null || true)"

    local name os id
    # Prefer a concrete, booted/available device id.
    id="$(printf '%s\n' "$dests" | grep -E 'platform:iOS Simulator' \
          | grep -E 'name:iPhone' | head -n1 | sed -E 's/.*id:([^ ,]+).*/\1/')"
    if [ -n "$id" ] && [ "$id" != "dvtdevice-DVTiOSDeviceSimulatorPlaceholder-iphonesimulator:placeholder" ]; then
        printf 'platform=iOS Simulator,id=%s\n' "$id"
        return 0
    fi

    # Next: any concrete named/OS device.
    name="$(printf '%s\n' "$dests" | grep -E 'platform:iOS Simulator' \
            | grep -E 'name:iPhone' | head -n1 | sed -E 's/.*name:([^,]+).*/\1/' | xargs)"
    os="$(printf '%s\n' "$dests" | grep -E 'platform:iOS Simulator' \
          | grep -E 'name:iPhone' | head -n1 | sed -E 's/.*OS:([0-9.]+).*/\1/')"
    if [ -n "$name" ]; then
        if [ -n "$os" ]; then
            printf 'platform=iOS Simulator,name=%s,OS=%s\n' "$name" "$os"
        else
            printf 'platform=iOS Simulator,name=%s\n' "$name"
        fi
        return 0
    fi

    # Last resort: generic build (compiles without a concrete device).
    printf 'generic/platform=iOS Simulator\n'
}

# device_family_destination -> for archives we want a device; return generic iOS
generic_device_destination() {
    printf 'generic/platform=iOS\n'
}

# --- Version helpers ------------------------------------------------------
read_marketing_version() {
    /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" \
        "$VANTA_PROJECT_DIR/Veyra/Resources/Info.plist" 2>/dev/null \
        || printf '1.0'
}

read_build_number() {
    /usr/libexec/PlistBuddy -c "Print :CFBundleVersion" \
        "$VANTA_PROJECT_DIR/Veyra/Resources/Info.plist" 2>/dev/null \
        || printf '1'
}
