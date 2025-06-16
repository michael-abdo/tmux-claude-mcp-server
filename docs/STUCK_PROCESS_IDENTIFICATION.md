# Stuck Process Identification Criteria

## Overview
This document provides explicit criteria for identifying stuck vs legitimate Claude processes to prevent false positives when cleaning up system resources.

## STUCK Process Criteria (Multiple indicators required)

### 1. Bridge Process Hanging (HIGHEST CONFIDENCE)
- **Pattern**: `node .../mcp_bridge.js read {"instanceId":"...","lines":...}`
- **Expected Duration**: < 30 seconds (bridge operations are ephemeral)
- **Stuck If**: Running > 5 minutes
- **Action**: Kill immediately

### 2. Missing Tmux Session (HIGH CONFIDENCE)
- **Check**: `tmux list-sessions | grep claude_INSTANCE_ID`
- **Stuck If**: No matching tmux session BUT process still running
- **Verify**: Cross-reference with instances.json registry
- **Action**: Kill process and clean registry entry

### 3. Repetitive Failed Operations
- **Pattern**: Multiple processes with identical commands
- **Example**: 3+ processes all reading from same instanceId
- **Stuck If**: Same exact operation spawned multiple times
- **Action**: Kill all but most recent, investigate source

### 4. Corrupted Instance IDs
- **Pattern**: Instance IDs containing "undefined"
- **Example**: `spec_undefined_undefined_123456`
- **Stuck If**: Any undefined in hierarchical ID structure
- **Action**: Kill immediately, indicates system corruption

### 5. Impossible Resource Usage
- **CPU Time**: More CPU hours than elapsed time
- **Example**: 683 CPU hours for 17 hour runtime
- **Stuck If**: CPU time > 2x elapsed time
- **Action**: Kill, likely accounting error or tight loop

## LEGITIMATE High CPU Process Criteria

### 1. Active Tmux Session
- **Verify**: `tmux list-sessions` shows the session
- **Test**: `tmux capture-pane -t "session:0.0" -p | tail -5`
- **Legitimate If**: Can capture recent output

### 2. Progressive Memory Growth
- **Pattern**: Memory increasing gradually over time
- **Legitimate If**: Processing new data, building context
- **NOT Stuck If**: Memory plateaus but CPU remains high

### 3. Recent Activity
- **Check**: Project directory for recent file changes
- **Check**: Tmux pane for recent output
- **Legitimate If**: Activity within last 10 minutes

### 4. Expected Long-Running Tasks
- **Code analysis**: Can run for hours at high CPU
- **Large refactoring**: Sustained high CPU normal
- **Test suites**: May spike CPU periodically
- **Monitoring tasks**: Continuous but varying CPU

## Quick Diagnostic Commands

```bash
# Check if session exists for specific instance
tmux list-sessions | grep claude_INSTANCE_ID

# Test session responsiveness (5 second timeout)
timeout 5s tmux capture-pane -t "claude_INSTANCE_ID:0.0" -p | tail -10

# Find stuck bridge processes
ps aux | grep "mcp_bridge.js read" | grep -v grep

# Find processes with corrupted IDs
ps aux | grep "undefined" | grep claude | grep -v grep

# Check process age and CPU time
ps -p PID -o pid,etime,time,command

# Find repetitive commands
ps aux | grep claude | sort | uniq -c | sort -n
```

## Decision Tree

1. Is it a bridge process > 5 minutes old? → **KILL**
2. Does the tmux session exist?
   - No → **KILL** 
   - Yes → Continue checks
3. Can you capture pane output within 5 seconds?
   - No → **KILL**
   - Yes → Continue checks
4. Has there been activity in last 10 minutes?
   - No → Investigate further
   - Yes → **KEEP**
5. Is CPU time > 2x elapsed time?
   - Yes → **KILL**
   - No → **KEEP**

## Important Notes

- **Never kill based on CPU usage alone**
- **Always verify tmux session exists first**
- **Bridge processes should never run > 5 minutes**
- **When in doubt, try to capture pane content**
- **Document any kills for pattern analysis**

## Common False Positives to Avoid

1. **Code Analysis Tasks**: Can legitimately use 100%+ CPU for hours
2. **Test Runners**: May spike CPU periodically
3. **Compilation Tasks**: High sustained CPU is normal
4. **AI Problem Solving**: Complex reasoning uses high CPU
5. **File Processing**: Large file operations spike CPU

## Monitoring Commands

```bash
# Watch for new stuck processes
watch -n 30 'ps aux | grep "mcp_bridge.js read" | grep -v grep'

# Monitor high CPU processes
watch -n 10 'ps aux | grep claude | sort -k3 -nr | head -10'

# Check for zombie sessions
tmux list-sessions | while read session; do
  session_name=$(echo $session | cut -d: -f1)
  if ! ps aux | grep -q "$session_name"; then
    echo "Zombie session: $session_name"
  fi
done
```