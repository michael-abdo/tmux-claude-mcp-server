#!/usr/bin/env bash

# Usage: ./script.sh HH:MM:SS
TARGET="$1"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 HH:MM:SS"
  exit 1
fi

# Convert target time to epoch
NOW_EPOCH=$(date +%s)
TARGET_EPOCH=$(date -j -f "%H:%M:%S" "$TARGET" "+%s" 2>/dev/null)

# If target time has passed today, add 24h
if [ "$TARGET_EPOCH" -le "$NOW_EPOCH" ]; then
  TARGET_EPOCH=$((TARGET_EPOCH + 86400))
fi

# Sleep until then
SLEEP_SECONDS=$((TARGET_EPOCH - NOW_EPOCH))
sleep "$SLEEP_SECONDS"

# Run AppleScript
osascript <<'APPLESCRIPT'
tell application "Terminal"
	set maxCount to 20
	set winCount to count of windows
	set processed to 0
	
	repeat with i from 1 to winCount
		try
			set t to selected tab of window i
			do script "plz continue" in t
			do script "" in t
			set processed to processed + 1
			if processed ≥ maxCount then exit repeat
		end try
	end repeat
end tell
APPLESCRIPT
