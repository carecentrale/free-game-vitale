#!/usr/bin/env bash
# Ask the build laptop for a build from anywhere, through GitHub (see scripts/build-watcher.ps1).
#   scripts/remote-build.sh quick     ask for: full, quick, build, check or status
#   scripts/remote-build.sh result    show the last status the build laptop posted
# Run it in any clone of the repository that can push to GitHub. It does not touch main or the files in the folder.
set -euo pipefail
word="${1:-result}"
if [ "$word" = "result" ]; then
  git fetch --quiet origin build-status
  git show FETCH_HEAD:status.txt
  exit 0
fi
case "$word" in full|quick|build|check|status) ;; *) echo "Use: full, quick, build, check, status or result" >&2; exit 2 ;; esac
line="$word $(date -u +%Y%m%dT%H%M%SZ)"
blob=$(printf '%s\n' "$line" | git hash-object -w --stdin)
tree=$(printf '100644 blob %s\trequest.txt\n' "$blob" | git mktree)
commit=$(git -c user.name=remote-build -c user.email=remote-build@localhost commit-tree "$tree" -m "Build request: $line")
git push --quiet --force origin "$commit:refs/heads/build-remote"
echo "Asked the build laptop for: $line"
echo "It looks about once a minute. Then: scripts/remote-build.sh result"
