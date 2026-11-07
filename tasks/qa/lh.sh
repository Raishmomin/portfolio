#!/usr/bin/env bash
# Usage: lh.sh <baseUrl> <outDir> <path> [path...]   — mobile Lighthouse, prints scores + CWV per path
set -u
T="$(cd "$(dirname "$0")" && pwd)"
export CHROME_PATH=/home/raish/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome
base="$1"; out="$2"; shift 2; mkdir -p "$out"
for p in "$@"; do
  f="$out/$(echo "$p" | sed 's#/#_#g;s#^_##;s#^$#index#').json"; [ "$p" = "/" ] && f="$out/index.json"
  "$T/node_modules/.bin/lighthouse" "$base$p" --quiet --output=json --output-path="$f" \
    --chrome-flags="--headless=new --no-sandbox" --only-categories=performance,accessibility,best-practices,seo >/dev/null 2>&1
  node -e '
    const r=require(process.argv[1]); const c=r.categories, a=r.audits;
    const s=k=>Math.round((c[k]?.score??0)*100);
    console.log([process.argv[2],"perf",s("performance"),"a11y",s("accessibility"),"bp",s("best-practices"),"seo",s("seo"),
      "LCP",a["largest-contentful-paint"]?.displayValue,"CLS",a["cumulative-layout-shift"]?.displayValue,"TBT",a["total-blocking-time"]?.displayValue].join(" "));
  ' "$f" "$p" 2>/dev/null || echo "$p FAILED"
done
