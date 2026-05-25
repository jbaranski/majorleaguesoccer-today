#!/usr/bin/env bash
# Checks todayMatches and yesterdayResults in matches.json.
# Writes has_fixtures=true/false to $GITHUB_OUTPUT.
#
# Optional env vars:
#   SKIP_FIXTURE_CHECK  "true" bypasses check, always writes has_fixtures=true
#   MATCHES_JSON_PATH   path to matches.json (default: client/public/matches.json)

set -euo pipefail
IFS=$'\n\t'

readonly SKIP_FIXTURE_CHECK="${SKIP_FIXTURE_CHECK:-false}"
readonly MATCHES_JSON_PATH="${MATCHES_JSON_PATH:-client/public/matches.json}"

if [[ "${SKIP_FIXTURE_CHECK}" != "true" ]] && [[ "${SKIP_FIXTURE_CHECK}" != "false" ]]; then
  echo "Error: SKIP_FIXTURE_CHECK must be 'true' or 'false', got '${SKIP_FIXTURE_CHECK}'" >&2
  exit 1
fi

if [[ "${SKIP_FIXTURE_CHECK}" == "true" ]]; then
  echo "Fixture check skipped (SKIP_FIXTURE_CHECK=true)"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "has_fixtures=true" >> "${GITHUB_OUTPUT}"
  fi
  exit 0
fi

if [[ ! -f "${MATCHES_JSON_PATH}" ]]; then
  echo "Error: matches.json not found at '${MATCHES_JSON_PATH}'" >&2
  exit 1
fi

if ! jq -e 'has("todayMatches") and has("yesterdayResults")' "${MATCHES_JSON_PATH}" > /dev/null; then
  echo "Error: matches.json is missing required keys (todayMatches, yesterdayResults)" >&2
  exit 1
fi

TODAY_COUNT=$(jq '.todayMatches | length' "${MATCHES_JSON_PATH}")
YESTERDAY_COUNT=$(jq '.yesterdayResults | length' "${MATCHES_JSON_PATH}")

if [[ "${TODAY_COUNT}" -eq 0 ]] && [[ "${YESTERDAY_COUNT}" -eq 0 ]]; then
  echo "No fixtures today and no results from yesterday, skipping email send"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "has_fixtures=false" >> "${GITHUB_OUTPUT}"
  fi
else
  echo "Found ${TODAY_COUNT} fixtures for today, ${YESTERDAY_COUNT} results from yesterday"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "has_fixtures=true" >> "${GITHUB_OUTPUT}"
  fi
fi
