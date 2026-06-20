#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install Node 24 (matches CI) via nvm and set as default
export NVM_DIR="/opt/nvm"
# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24

# Playwright ships with chromium-1228 but the container has chromium-1194.
# Symlink the installed binary so tests can find it without a network download.
CHROMIUM_TARGET=/opt/pw-browsers/chromium-1228/chrome-linux64/chrome
if [ ! -f "$CHROMIUM_TARGET" ]; then
  mkdir -p "$(dirname "$CHROMIUM_TARGET")"
  ln -sf /opt/pw-browsers/chromium-1194/chrome-linux/chrome "$CHROMIUM_TARGET"
fi

# Root TypeScript project
npm install --prefix "$CLAUDE_PROJECT_DIR"

# Angular client
npm install --prefix "$CLAUDE_PROJECT_DIR/client"
