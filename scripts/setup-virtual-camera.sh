#!/usr/bin/env bash
#
# Veyra — Linux virtual camera setup (v4l2loopback)
#
# Loads the v4l2loopback kernel module and exposes a "Veyra Camera" device.
# Requires root for modprobe. Run once after install, or whenever the module
# is not loaded (e.g. after reboot).
#
#   sudo bash scripts/setup-virtual-camera.sh
#
# Reboots remove the module; either re-run this or load it at boot, e.g.:
#   echo 'v4l2loopback' | sudo tee /etc/modules-load.d/veyra.conf
#   echo 'options v4l2loopback video_nr=10 card_label="Veyra Camera" exclusive_caps=1' \
#     | sudo tee /etc/modprobe.d/veyra.conf

set -euo pipefail

CARD_LABEL="Veyra Camera"
VIDEO_NR=10
DEVICE="/dev/video${VIDEO_NR}"

log() { printf '\033[1;32m[veyra]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[veyra]\033[0m %s\n' "$*"; }

if [ "$(id -u)" -ne 0 ]; then
  warn "This script needs root. Re-run it with:"
  warn "  sudo bash scripts/setup-virtual-camera.sh"
  exit 1
fi

if ! modinfo v4l2loopback >/dev/null 2>&1; then
  log "v4l2loopback kernel module is not installed."
  if command -v pacman >/dev/null 2>&1; then
    log "Installing with pacman:"
    pacman -S --noconfirm v4l2loopback-dkms || { warn "Install failed — try 'sudo pacman -S v4l2loopback-dkms' manually."; exit 1; }
  else
    warn "Install v4l2loopback for your distribution first, then re-run."
    exit 1
  fi
fi

if lsmod | grep -q '^v4l2loopback'; then
  log "v4l2loopback already loaded."
else
  log "Loading v4l2loopback (device /dev/video${VIDEO_NR}, label \"${CARD_LABEL}\")…"
  modprobe v4l2loopback video_nr="${VIDEO_NR}" card_label="${CARD_LABEL}" exclusive_caps=1
fi

if [ -e "$DEVICE" ]; then
  log "Veyra Camera ready at ${DEVICE}."
  log "Optional: persist across reboots with /etc/modules-load.d + /etc/modprobe.d (see script header)."
else
  warn "Module loaded but ${DEVICE} was not created. Try a different video_nr or check kernel headers."
  exit 1
fi
