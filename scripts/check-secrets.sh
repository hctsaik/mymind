#!/usr/bin/env bash
# Fails if anything that looks like a GitHub token or OpenAI key is in the repo.
# Runs as a git pre-commit hook (.githooks/pre-commit) and in GitHub Actions.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"
PATTERN='(github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'
if git rev-parse --git-dir >/dev/null 2>&1; then
  # tracked files + whatever is staged right now
  FILES=$( { git ls-files; git diff --cached --name-only --diff-filter=ACMR; } | sort -u )
else
  FILES=$(find . -type f -not -path './node_modules/*' -not -path './.git/*')
fi
hits=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in node_modules/*|*.png|*.jpg|*.ico) continue;; esac
  if grep -EnH "$PATTERN" "$f" >/dev/null 2>&1; then
    echo "✗ 疑似金鑰：$f"; grep -EnoH "$PATTERN" "$f" | sed -E 's/(:[0-9]+:.{0,12}).*/\1…（已遮蔽）/'
    hits=$((hits+1))
  fi
done <<< "$FILES"
# staged content (catches secrets in the index even if the working copy was cleaned)
if git rev-parse --git-dir >/dev/null 2>&1 && git diff --cached -U0 | grep -E '^\+' | grep -Eq "$PATTERN"; then echo "✗ 暫存區（staged）內容含疑似金鑰"; hits=$((hits+1)); fi
if [ "$hits" -gt 0 ]; then echo "請移除金鑰後再提交。金鑰只能存在瀏覽器的 localStorage。"; exit 1; fi
echo "✓ 沒有發現金鑰或 token"
