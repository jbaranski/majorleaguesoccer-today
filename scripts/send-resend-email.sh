#!/usr/bin/env bash
# Sends a single email via the Resend API.
#
# Required env vars:
#   RESEND_API_KEY, FROM_EMAIL, TO_EMAIL, SUBJECT, BASE_HTML, UNSUBSCRIBE_URL
#
# Exits 0 on success, 1 on HTTP error.
set -euo pipefail

EMAIL_HTML="${BASE_HTML//\{\{UNSUBSCRIBE_URL\}\}/${UNSUBSCRIBE_URL}}"

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

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 30 \
  -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
  exit 1
fi
