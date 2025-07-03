#!/usr/bin/env bash

# Usage: ./script.sh INTERVAL_MINUTES COUNT
INTERVAL_MINUTES="$1"
COUNT="$2"

if [ -z "$INTERVAL_MINUTES" ] || [ -z "$COUNT" ]; then
  echo "Usage: $0 INTERVAL_MINUTES COUNT"
  echo "Example: $0 5 10  # Send every 5 minutes, 10 times"
  exit 1
fi

INTERVAL_SECONDS=$((INTERVAL_MINUTES * 60))

echo "Sending 'plz continue' every $INTERVAL_MINUTES minutes, $COUNT times"

for i in $(seq 1 "$COUNT"); do
  echo "Iteration $i/$COUNT at $(date)"
  
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

  # Sleep unless it's the last iteration
  if [ "$i" -lt "$COUNT" ]; then
    echo "Sleeping for $INTERVAL_MINUTES minutes..."
    sleep "$INTERVAL_SECONDS"
  fi
done

echo "Completed all $COUNT iterations"