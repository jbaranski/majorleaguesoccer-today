#!/usr/bin/env bash
# Sends a single email via the Resend API.
#
# Required env vars:
#   RESEND_API_KEY  Resend API key
#   FROM_EMAIL      Sender address
#   TO_EMAIL        Recipient address
#   SUBJECT         Email subject line
#   BASE_HTML       Raw HTML with {{UNSUBSCRIBE_URL}} placeholder
#   UNSUBSCRIBE_URL Value substituted for the placeholder
#
# Exits 0 on success, 1 on missing env var or non-2xx HTTP response.

set -euo pipefail
IFS=$'\n\t'

# Validate required env vars — :? prints to stderr and exits 1 if unset/empty
: "${RESEND_API_KEY:?Required env var RESEND_API_KEY is not set}"
: "${FROM_EMAIL:?Required env var FROM_EMAIL is not set}"
: "${TO_EMAIL:?Required env var TO_EMAIL is not set}"
: "${SUBJECT:?Required env var SUBJECT is not set}"
: "${BASE_HTML:?Required env var BASE_HTML is not set}"
: "${UNSUBSCRIBE_URL:?Required env var UNSUBSCRIBE_URL is not set}"

EMAIL_HTML="${BASE_HTML//\{\{UNSUBSCRIBE_URL\}\}/${UNSUBSCRIBE_URL}}"
readonly EMAIL_HTML

PAYLOAD=$(jq -n \
  --arg from "MLS Today <${FROM_EMAIL}>" \
  --arg to "${TO_EMAIL}" \
  --arg subject "${SUBJECT}" \
  --arg html "${EMAIL_HTML}" \
  --arg unsub "${UNSUBSCRIBE_URL}" \
  '{from: $from, to: [$to], subject: $subject, html: $html,
    headers: {
      "List-Unsubscribe": ("<" + $unsub + ">"),
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    }}')
readonly PAYLOAD

RESPONSE_BODY=$(mktemp)
trap 'rm -f "${RESPONSE_BODY}"' EXIT

HTTP_STATUS=$(curl -s -w "%{http_code}" \
  --max-time 30 \
  -o "${RESPONSE_BODY}" \
  -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD") || {
  echo "curl failed (network or timeout error)" >&2
  exit 1
}
readonly HTTP_STATUS

if [[ "${HTTP_STATUS}" -lt 200 ]] || [[ "${HTTP_STATUS}" -ge 300 ]]; then
  echo "Resend API returned HTTP ${HTTP_STATUS}" >&2
  cat "${RESPONSE_BODY}" >&2
  exit 1
fi
