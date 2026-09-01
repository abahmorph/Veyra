#!/usr/bin/env bash
#
# Veyra — Linux virtual microphone setup (PipeWire / PulseAudio null sink)
#
# Creates a "Veyra Microphone" sink whose monitor source can be selected as a
# microphone by any call app. No root required.
#
#   bash scripts/setup-virtual-mic.sh

set -euo pipefail

SINK="veyra_mic"
LABEL="Veyra Microphone"

log() { printf '\033[1;32m[veyra]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[veyra]\033[0m %s\n' "$*"; }

if ! command -v pactl >/dev/null 2>&1; then
  warn "pactl not found. Install PipeWire (pipewire-pulse) or PulseAudio, then retry."
  exit 1
fi

if pactl list short sinks 2>/dev/null | grep -q "${SINK}"; then
  log "Veyra Microphone sink already exists: ${SINK}."
else
  log "Creating null sink \"${LABEL}\"…"
  pactl load-module module-null-sink \
    "sink_name=${SINK}" \
    "sink_properties=device.description=${LABEL}" >/dev/null
fi

log "Done. Select \"${LABEL}\" (source ${SINK}.monitor) as your microphone in call apps."
log "To route Veyra's processed audio there, set the app's output device to \"${LABEL}\"."
