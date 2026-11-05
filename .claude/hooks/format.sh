#!/usr/bin/env bash
# PostToolUse: auto-fix lint issues in the TypeScript file Claude just edited.
FILE=$(python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get(\"tool_input\",{}).get(\"file_path\",\"\"))" 2>/dev/null || true)
case "$FILE" in
  *.ts|*.tsx) [ -x node_modules/.bin/oxlint ] && node_modules/.bin/oxlint --fix "$FILE" > /dev/null ;;
esac
exit 0
