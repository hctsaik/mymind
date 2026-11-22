#!/usr/bin/env bash
# The service worker serves the app from a cache named after VERSION. If app files change without a
# VERSION bump, installed copies would keep the old files. This check (pre-commit + CI) enforces:
#  1. sw.js VERSION == js/version.js VERSION
#  2. every js/*.js and css/*.css is in the sw.js SHELL list
#  3. (pre-commit) if app-shell files are staged, VERSION must change in the same commit
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"
sv=$(sed -nE "s/^const VERSION='([^']+)'.*/\1/p" sw.js); av=$(sed -nE "s/^export const VERSION='([^']+)'.*/\1/p" js/version.js)
[ -n "$sv" ] && [ "$sv" = "$av" ] || { echo "✗ sw.js VERSION ($sv) 和 js/version.js ($av) 不一致"; exit 1; }
miss=0; for f in js/*.js css/*.css; do grep -q "'$f'" sw.js || { echo "✗ sw.js 的 SHELL 少了 $f"; miss=1; }; done; [ $miss = 0 ] || exit 1
if [ "${1:-}" = "--staged" ] && git rev-parse --git-dir >/dev/null 2>&1; then
  shell=$(git diff --cached --name-only --diff-filter=ACMRD | grep -E '^(index\.html|view\.html|manifest\.webmanifest|css/|js/|icons/)' || true)
  if [ -n "$shell" ] && ! git diff --cached -U0 -- sw.js | grep -qE "^\+const VERSION="; then
    echo "✗ 修改了 App 檔案但沒有更新版本：請同時改 sw.js 和 js/version.js 的 VERSION"; echo "$shell" | sed 's/^/   /'; exit 1; fi
fi
echo "✓ 版本 $sv，離線快取清單完整"
