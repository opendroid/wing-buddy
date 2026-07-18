#!/usr/bin/env bash
# WingBuddy server smoke harness — drives the full flow against a running server
# and asserts on the JSON. Usage:
#   BASE_URL=http://localhost:8080 ORIGIN=https://client.test ./scripts/smoke.sh
# Exits non-zero on the first failed assertion.
set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
ORIGIN="${ORIGIN:-https://client.test}"
pass=0 fail=0

ok()   { echo "  ok   $1"; pass=$((pass+1)); }
bad()  { echo "  FAIL $1"; fail=$((fail+1)); }
# assert <description> <haystack> <needle>
assert_contains() { case "$2" in *"$3"*) ok "$1";; *) bad "$1 (got: $2)";; esac; }
field() { echo "$1" | sed -n "s/.*\"$2\":\"\([^\"]*\)\".*/\1/p"; }

echo "== WingBuddy smoke @ $BASE_URL =="

echo "[1] POST /api/session"
S=$(curl -s -X POST "$BASE_URL/api/session" -H 'content-type: application/json' -d '{}')
SID=$(field "$S" sessionId); KEY=$(field "$S" requesterKey); T=$(field "$S" t); SC=$(field "$S" shareCode)
assert_contains "session has sessionId" "$S" '"sessionId"'
assert_contains "session seeds a flight" "$S" '"carrier":"UA"'
[ -n "$SID" ] && ok "captured sessionId" || bad "no sessionId"

echo "[2] GET /api/voice-token (auth gates)"
RT=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/voice-token?sessionId=$SID&role=joiner")
[ "$RT" = "401" ] && ok "joiner without t -> 401" || bad "joiner without t -> $RT"
# requester token mint hits real VB; only assert it is reachable (200 or 502 if key is a dummy)
RQ=$(curl -s -o /dev/null -w '%{http_code}' -H "x-wb-key: $KEY" "$BASE_URL/api/voice-token?sessionId=$SID&role=requester")
case "$RQ" in 200) ok "requester token minted (200)";; 502) ok "requester reached VB (502 — dummy key ok in mock smoke)";; *) bad "requester -> $RQ";; esac

echo "[3] POST /api/agent (wheelchair -> reconfirmed)"
A=$(curl -s -X POST "$BASE_URL/api/agent" -H "x-wb-key: $KEY" -H 'content-type: application/json' -d "{\"sessionId\":\"$SID\",\"query\":\"मुझे व्हीलचेयर चाहिए\"}")
assert_contains "wheelchair intent" "$A" '"intent":"wheelchair"'
assert_contains "ssr reconfirmed" "$A" '"ssr":"reconfirmed"'

echo "[4] POST /api/agent (medical -> declined, no advice)"
M=$(curl -s -X POST "$BASE_URL/api/agent" -H "x-wb-key: $KEY" -H 'content-type: application/json' -d "{\"sessionId\":\"$SID\",\"query\":\"how much medicine should I take\"}")
assert_contains "medical decline" "$M" '"intent":"medical_decline"'
case "$M" in *mg*) bad "leaked dosage";; *) ok "no dosage advice";; esac

echo "[5] POST /api/demo/disrupt (silent drop) + agent re-check"
D=$(curl -s -X POST "$BASE_URL/api/demo/disrupt?t=$T" -H 'content-type: application/json' -d '{"kind":"gate_change"}')
assert_contains "disrupt drops ssr" "$D" '"ssr":"dropped"'
ST=$(curl -s "$BASE_URL/api/session/$SID/state?t=$T")
assert_contains "state shows dropped" "$ST" '"ssr":"dropped"'
R=$(curl -s -X POST "$BASE_URL/api/agent" -H "x-wb-key: $KEY" -H 'content-type: application/json' -d "{\"sessionId\":\"$SID\",\"query\":\"गेट बदल गया, फिर से देखिए\"}")
assert_contains "re-check reconfirms" "$R" '"ssr":"reconfirmed"'

echo "[6] POST /api/relay"
RL=$(curl -s -X POST "$BASE_URL/api/relay?t=$T" -H 'content-type: application/json' -d '{"text":"Are you okay?","name":"Raj"}')
assert_contains "relay ok" "$RL" '"ok":true'
EV=$(curl -s "$BASE_URL/api/session/$SID/events?since=0&t=$T")
assert_contains "family_message logged" "$EV" '"type":"family_message"'

echo "[7] GET /api/healthz"
H=$(curl -s "$BASE_URL/api/healthz")
assert_contains "healthz ok" "$H" '"ok":true'

echo "[8] CORS preflight"
CH=$(curl -s -D - -o /dev/null -X OPTIONS "$BASE_URL/api/healthz" -H "origin: $ORIGIN")
assert_contains "ACAO for allowed origin" "$CH" "access-control-allow-origin: $ORIGIN"

echo "== $pass passed, $fail failed =="
[ "$fail" -eq 0 ]
