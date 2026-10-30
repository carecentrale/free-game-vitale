#!/usr/bin/env bash
# Keeps the kids game in step between the chat and Cowork, through GitHub.
#   ./scripts/sync.sh pull            get the latest work from GitHub
#   ./scripts/sync.sh push "message"  save your changes and send them to GitHub
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in
  pull)
    git pull --rebase origin main
    echo "Up to date with GitHub: $(git log --oneline -1)"
    ;;
  push)
    msg="${2:-Update from $(hostname)}"
    git add -A
    if git diff --cached --quiet; then
      echo "Nothing to save."
    else
      git commit -m "$msg"
    fi
    git push -u origin main
    ;;
  *)
    echo "Usage: $0 pull | push \"message\""
    exit 1
    ;;
esac
