#!/bin/bash
# Route check after the /work prefix came off the case studies (2026-11-10).
BASE="${QA_BASE:-http://localhost:3000}"

echo "=== new project URLs (expect 200) ==="
for s in sprouts-farmers-market corita-art-center socal-earth cultural-olympiad-poster valley-strong-credit-union more-work; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$s")
  printf '  %-30s %s\n' "/$s" "$code"
done

echo "=== old URLs (expect 308 -> /slug) ==="
for s in sprouts-farmers-market corita-art-center socal-earth cultural-olympiad-poster valley-strong-credit-union more-work; do
  out=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/work/$s")
  printf '  %-30s %s\n' "/work/$s" "$out"
done

echo "=== other routes (expect 200, 200, 200, 200, 404) ==="
for p in / /about /work /password /definitely-not-a-page; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE$p")
  printf '  %-30s %s\n' "$p" "$code"
done
