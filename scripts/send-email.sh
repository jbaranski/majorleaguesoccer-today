#!/usr/bin/env bash
# Prepares environment and sends one email via send-resend-email.sh.
#
# Required env vars:
#   RESEND_API_KEY  Resend API key
#   FROM_EMAIL      Sender address
#   TO_EMAIL        Recipient address
#   UNSUBSCRIBE_URL Unsubscribe URL (required unless IS_TEST="true")
#
# Optional env vars:
#   IS_TEST         "true"/"false" — adds [TEST] prefix and placeholder unsubscribe URL (default: "false")
#   DATE_OVERRIDE   YYYY-MM-DD date for subject line (defaults to today)
#   HTML_PATH       Path to rendered HTML (default: client/dist/client/browser/index.html)

set -euo pipefail
IFS=$'\n\t'

readonly IS_TEST="${IS_TEST:-false}"
readonly DATE_OVERRIDE="${DATE_OVERRIDE:-}"
readonly HTML_PATH="${HTML_PATH:-client/dist/client/browser/index.html}"

if [[ -n "${DATE_OVERRIDE}" ]] && ! [[ "${DATE_OVERRIDE}" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "Error: DATE_OVERRIDE must be YYYY-MM-DD, got '${DATE_OVERRIDE}'" >&2
  exit 1
fi

# Validate IS_TEST value
if [[ "${IS_TEST}" != "true" ]] && [[ "${IS_TEST}" != "false" ]]; then
  echo "Error: IS_TEST must be 'true' or 'false', got '${IS_TEST}'" >&2
  exit 1
fi

# Validate required env vars
: "${RESEND_API_KEY:?Required env var RESEND_API_KEY is not set}"
: "${FROM_EMAIL:?Required env var FROM_EMAIL is not set}"
: "${TO_EMAIL:?Required env var TO_EMAIL is not set}"

# Validate UNSUBSCRIBE_URL unless running in test mode
if [[ "${IS_TEST}" != "true" ]]; then
  : "${UNSUBSCRIBE_URL:?Required env var UNSUBSCRIBE_URL is not set}"
fi

# Validate HTML file exists
if [[ ! -f "${HTML_PATH}" ]]; then
  echo "Error: HTML file not found at '${HTML_PATH}'" >&2
  exit 1
fi

BASE_HTML=$(< "${HTML_PATH}")

# Strip <script> tags — email clients block scripts and checkers flag them as dangerous
BASE_HTML=$(printf '%s' "${BASE_HTML}" | sed -Ez \
  -e 's|<script\b[^>]*/>||g' \
  -e 's|<script\b[^>]*>[^<]*</script>||g')

# Compute subject date
if [[ -n "${DATE_OVERRIDE}" ]]; then
  if date --version > /dev/null 2>&1; then
    SUBJECT_DATE=$(date -d "${DATE_OVERRIDE}" +'%A, %B %d, %Y')
  else
    SUBJECT_DATE=$(date -jf '%Y-%m-%d' "${DATE_OVERRIDE}" +'%A, %B %d, %Y')
  fi
else
  SUBJECT_DATE=$(date +'%A, %B %d, %Y')
fi

# Build subject with or without [TEST] prefix
if [[ "${IS_TEST}" == "true" ]]; then
  SUBJECT="[TEST] Major League Soccer Today - ${SUBJECT_DATE}"
  UNSUBSCRIBE_URL="TEST_UNSUBSCRIBE_PLACEHOLDER"
else
  SUBJECT="Major League Soccer Today - ${SUBJECT_DATE}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export RESEND_API_KEY FROM_EMAIL TO_EMAIL SUBJECT BASE_HTML UNSUBSCRIBE_URL

bash "${SCRIPT_DIR}/send-resend-email.sh"
