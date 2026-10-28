#!/usr/bin/env bash
# Backend checks on the local Supabase stack: migrations, database tests (pgTAP) and edge function tests (Deno).
# Every worktree on this machine shares one stack, so checks take turns through a lock.
# Usage: scripts/check-backend.sh [--post]
#   --post  also posts the result as the local/backend status of the checked-out commit, which must be pushed
set -euo pipefail

post=false
case "${1:-}" in
  "") ;;
  --post) post=true ;;
  *) echo "usage: $0 [--post]" >&2; exit 2 ;;
esac

cd "$(git rev-parse --show-toplevel)"

# A status describes a commit, so check exactly what was pushed.
if $post; then
  if [ -n "$(git status --porcelain)" ]; then
    echo "uncommitted changes: commit and push before posting a status" >&2
    exit 1
  fi
  if ! git branch -r --contains HEAD | grep -q .; then
    echo "commit $(git rev-parse --short HEAD) is not pushed yet; push first" >&2
    exit 1
  fi
fi

# One check at a time. mkdir is atomic, so only one run can create the lock.
lock=/tmp/merinde-backend-check.lock
waited=0
until mkdir "$lock" 2>/dev/null; do
  # Older than 30 minutes: left behind by a run that was killed.
  if [ -n "$(find "$lock" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then
    echo "removing a stale lock from: $(cat "$lock/owner" 2>/dev/null)" >&2
    rm -rf "$lock"
    continue
  fi
  if [ "$waited" -ge 1200 ]; then
    echo "gave up after 20 minutes; the stack is still in use by: $(cat "$lock/owner" 2>/dev/null)" >&2
    exit 1
  fi
  if [ "$waited" -eq 0 ]; then
    echo "waiting for another backend check: $(cat "$lock/owner" 2>/dev/null)" >&2
  fi
  sleep 5
  waited=$((waited + 5))
done
log=$(mktemp)
trap 'rm -rf "$lock" "$log"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
echo "$(git rev-parse --abbrev-ref HEAD) (pid $$, since $(date '+%H:%M'))" > "$lock/owner"

# step <title> <command...>: runs one check, showing its output and keeping it in $log
step() {
  echo "==> $1"
  shift
  "$@" 2>&1 | tee "$log"
}

# finish <success|failure> <summary>: reports the result, posts it with --post, and exits
finish() {
  echo
  echo "local/backend $1: $2"
  if $post; then
    scripts/status.sh local/backend "$1" "$2"
  fi
  if [ "$1" = success ]; then
    exit 0
  fi
  exit 1
}

if $post; then
  scripts/status.sh local/backend pending "running migrations and tests"
fi

if ! npx supabase status >/dev/null 2>&1; then
  echo "==> starting the local Supabase stack"
  if ! npx supabase start >"$log" 2>&1; then
    tail -n 30 "$log"
    finish failure "the local Supabase stack didn't start (is Docker running?)"
  fi
fi

migrations=$(find supabase/migrations -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')
step "applying $migrations migrations to a fresh database" npx supabase db reset \
  || finish failure "migrations failed: $(grep -m1 -E 'ERROR' "$log" | sed -E 's/.*ERROR:? *//')"

step "database tests" npx supabase test db \
  || finish failure "database tests failed: $(grep -m1 -E '^# Failed test|ERROR:' "$log" | sed -E 's/^# Failed test [0-9]+: //; s/.*ERROR: *//')"
db_tests=$(grep -oE 'Tests=[0-9]+' "$log" | tail -n 1 | cut -d= -f2)

# Deno's test file names: test.ts, *_test.ts, *.test.ts (and .tsx, .mts, .js, .mjs, .jsx)
if find supabase/functions -type f 2>/dev/null | grep -qE '(^|/)([^/]*[._])?test\.(ts|tsx|mts|js|mjs|jsx)$'; then
  step "edge function tests" env NO_COLOR=1 npx --yes deno test supabase/functions \
    || finish failure "edge function tests failed: $(grep -oE '[0-9]+ failed' "$log" | tail -n 1 | grep . \
      || grep -m1 -E '^error' "$log" || echo 'see the output')"
  fn_tests=$(grep -oE '[0-9]+ passed' "$log" | tail -n 1 | cut -d' ' -f1)
  finish success "$migrations migrations; $db_tests database and $fn_tests edge function tests passed"
fi

finish success "$migrations migrations; $db_tests database tests passed; no edge function tests yet"
