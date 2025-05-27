# Common Intervention Pattern: The Enter Key Problem

## The Universal Pattern

**Every single Claude instance requires manual Enter key presses to process messages**

### Pattern Details:
1. Instance receives message via `tmux send-keys`
2. Message appears in terminal
3. Claude shows "Bypassing Permissions" at bottom
4. **Instance freezes indefinitely**
5. Manual `tmux send-keys -t [session] Enter` required
6. Only then does Claude process the message

### Occurrence Rate: 100%
- Executive: 3+ times
- UI/UX Manager: 2+ times  
- Frontend Manager: 2+ times
- Integration Manager: 2+ times

## The Fix

Add automatic Enter key sending to the MCP bridge/tools:

```javascript
// In tmux_interface.js or mcp_tools.js
async sendKeys(paneTarget, text, sendEnter = true) {
    await this.tmux.sendKeys(paneTarget, text);
    if (sendEnter) {
        await new Promise(resolve => setTimeout(resolve, 100));
        await this.tmux.sendKeys(paneTarget, '', true); // Send Enter
    }
}
```

Or in the send tool:
```javascript
async send(params, callerRole) {
    // ... existing code ...
    await this.tmux.sendKeys(paneTarget, params.text, true);
    
    // Add automatic Enter after brief delay
    await new Promise(resolve => setTimeout(resolve, 200));
    await this.tmux.sendKeys(paneTarget, '', true);
    
    return { success: true };
}
```

## Why This Happens

The `--dangerously-skip-permissions` flag seems to put Claude in a mode where it doesn't automatically process piped/pasted input. It waits for explicit user confirmation (Enter key) before processing any message.

This is likely a safety feature, but it breaks automation.

## Impact on Orchestration

Without fixing this:
- No autonomous operation possible
- Every message requires manual intervention
- Breaks the entire executive→manager→specialist flow
- Makes the system unusable for real automation

## Priority: CRITICAL

This single issue accounts for 90% of all manual interventions needed.