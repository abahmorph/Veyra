#!/usr/bin/env bash
#
# test.sh - Build for the simulator and run the Veyra test suite.
#
# 1. Resolves the project/scheme and chooses an installed simulator.
# 2. Builds the app for the simulator (Debug).
# 3. Runs the tests.
#    -> Stops immediately with a TEST FAILURE if any test fails.
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

require_cmd "xcodebuild" "Xcode is required to build and test."
require_cmd "xcrun"      "Xcode command line tools are required."

[ -e "$VANTA_PROJECT_FILE" ] || die "ENVIRONMENT FAILURE" \
    "Project not found: $VANTA_PROJECT_FILE" \
    "Set VANTA_PROJECT_DIR to the directory containing Veyra.xcodeproj."

DEST="$(detect_simulator_destination)"
info "Simulator destination: $DEST"
info "Building scheme '$VANTA_SCHEME' ($VANTA_TEST_CONFIG) for the simulator..."

mkdir -p "$VANTA_BUILD_DIR"

if ! xcodebuild build \
        -project "$VANTA_PROJECT_FILE" \
        -scheme "$VANTA_SCHEME" \
        -configuration "$VANTA_TEST_CONFIG" \
        -destination "$DEST" \
        -derivedDataPath "$VANTA_BUILD_DIR/derived" \
        CODE_SIGNING_ALLOWED=NO 2>&1 | tee "$VANTA_BUILD_DIR/build.log" | grep -E "error:|warning:|BUILD" ; then
    # grep may return 1 if no matching lines; that's fine because set -o pipefail
    # will surface the exit code of xcodebuild correctly.
    :
fi

if ! grep -q "BUILD SUCCEEDED" "$VANTA_BUILD_DIR/build.log"; then
    die "BUILD FAILURE" \
        "The simulator build failed." \
        "Reason: inspect '$VANTA_BUILD_DIR/build.log' for the compiler error above." \
        "Recommended action: fix the reported source error and re-run."
fi
ok "BUILD SUCCEEDED"

info "Running tests..."

if ! xcodebuild test \
        -project "$VANTA_PROJECT_FILE" \
        -scheme "$VANTA_SCHEME" \
        -configuration "$VANTA_TEST_CONFIG" \
        -destination "$DEST" \
        -derivedDataPath "$VANTA_BUILD_DIR/derived" \
        CODE_SIGNING_ALLOWED=NO 2>&1 | tee "$VANTA_BUILD_DIR/test.log" | grep -E "error:|failed|TEST"; then
    :
fi

if grep -q "TEST SUCCEEDED" "$VANTA_BUILD_DIR/test.log"; then
    ok "TEST SUCCEEDED"
else
    die "TEST FAILURE" \
        "One or more tests failed." \
        "Reason: inspect '$VANTA_BUILD_DIR/test.log' for the failing assert/exceptions." \
        "Recommended action: run the app and reproduce, then fix the failing unit test."
fi

stats="$(grep -E "Executed [0-9]+ tests" "$VANTA_BUILD_DIR/test.log" | tail -n1 || true)"
if [ -n "$stats" ]; then
    info "$stats"
fi
ok "VANTA TEST STAGE COMPLETE"
