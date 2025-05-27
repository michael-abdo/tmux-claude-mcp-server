# Enter Key Fix Documentation

## Problem
Claude instances in `--dangerously-skip-permissions` mode freeze after receiving messages via tmux, showing "Bypassing Permissions" and requiring manual Enter key presses.

## Root Cause
Although the code was already sending Enter (`C-m`) immediately after text, Claude needs:
1. A delay between receiving text and Enter
2. Sometimes multiple Enter presses

## Solution Implemented

### 1. tmux_interface.js (line 115)
```javascript
if (enter) {
    // Add delay to let Claude process the text before Enter
    await new Promise(resolve => setTimeout(resolve, 500));
    await execAsync(`tmux send-keys -t "${target}" "C-m"`);
}
```

### 2. instance_manager.js (lines 477-483)  
```javascript
// Send text with Enter
await this.tmux.sendKeys(instance.paneTarget, text, true);

// Send another Enter after delay as safety measure
await new Promise(resolve => setTimeout(resolve, 1500));
await this.tmux.sendKeys(instance.paneTarget, '', true);
console.log(`Sent additional Enter to ${instanceId} for safety`);
```

## Timing Pattern
1. Send message text
2. Wait 500ms
3. Send first Enter
4. Wait 1500ms  
5. Send second Enter (safety)

Total delay: 2 seconds per message

## Why This Works
- The 500ms delay gives Claude time to register the text input
- The first Enter processes the message
- The second Enter (after 1.5s) handles cases where Claude needs additional confirmation
- This matches the manual intervention pattern we observed

## Testing
To verify this fix works:
1. Spawn a new instance
2. Send a message
3. Instance should process without manual intervention
4. Check for "Sent additional Enter to [instanceId] for safety" in logs