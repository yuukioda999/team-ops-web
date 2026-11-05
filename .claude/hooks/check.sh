#!/usr/bin/env bash
# Stop: type-check and test before Claude finishes. Exit 2 makes Claude keep working on failures.
[ -d node_modules ] || exit 0
if ! out=$(npm run -s typecheck 2>&1 && npm test --silent 2>&1); then
  echo "Type check or tests are failing. Fix them before finishing:" >&2
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
