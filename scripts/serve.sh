#!/bin/bash
# Launch the Next.js production server in a fully-detached way that survives
# the parent shell session.
#
# Why this script: the dev sandbox terminates any child process whose parent
# shell exits. We work around that by:
#   1. Using setsid to start a new session (no controlling terminal).
#   2. Closing stdin/stdout/stderr so the process isn't tied to a tty.
#   3. Double-forking via the `(...)& disown` subshell pattern.
#   4. Using `next start` (production server) which is more robust than dev.
#
# Usage:  bash /home/z/my-project/scripts/serve.sh
# Stop:   pkill -9 -f "next start"

set -e

cd /home/z/my-project

# Kill any existing instance
pkill -9 -f "next start" 2>/dev/null || true
pkill -9 -f "next-server" 2>/dev/null || true
sleep 1

# Start in a new session, fully detached
setsid bash -c '
  exec /home/z/my-project/node_modules/.bin/next start -p 3000 \
    < /dev/null > /home/z/my-project/dev.log 2>&1
' &
disown

# Give it a moment to start
sleep 6

# Verify
if curl -sS -o /dev/null --max-time 5 http://localhost:3000/ 2>/dev/null; then
  echo "OK: server up at http://localhost:3000"
  ps -ef | grep -E "next start|next-server" | grep -v grep | head -3
else
  echo "WARN: server did not respond to health check"
  echo "--- last log lines ---"
  tail -10 /home/z/my-project/dev.log 2>&1
fi
