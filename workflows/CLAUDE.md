# CRITICAL: Keyword-Driven Orchestration Mechanism - NEVER FORGET

## 🚨 THE CORE PRINCIPLE YOU MUST ALWAYS REMEMBER

**This workflow system is built on polling-based keyword detection.** When you see prompts ending with "WHEN YOU ARE DONE YOU MUST SAY '***KEYWORD***'", this is NOT just a suggestion - it's the ONLY way the workflow advances.

## 🔧 How It Actually Works (Technical Implementation)

### 1. Prompt Delivery
```javascript
// Workflow sends prompt to Claude instance via MCP bridge
await bridge.send({
  instanceId: "spec_1_1_123456",
  text: "Implement feature X. WHEN DONE SAY '***FEATURE_COMPLETE***'"
});
```

### 2. Keyword Monitor Activation
```javascript
// KeywordMonitor starts polling immediately after prompt sent
const monitor = new KeywordMonitor({
  instanceId: "spec_1_1_123456",
  keyword: "***FEATURE_COMPLETE***",
  pollInterval: 5, // seconds
  timeout: 300     // 5 minutes max
});
```

### 3. Continuous Polling Loop
```javascript
// Every 5 seconds, monitor does this:
const result = await bridge.read({
  instanceId: instanceId,
  lines: 200  // Read last 200 lines of tmux output
});

// Append to rolling buffer (keeps last 1000 chars)
this.outputBuffer = this.outputBuffer.slice(-1000) + result.output;

// Search for exact keyword match
if (this.outputBuffer.includes("***FEATURE_COMPLETE***")) {
  // WORKFLOW ADVANCES TO NEXT STAGE
  this.emit('keyword_detected', context, keyword);
}
```

### 4. Workflow Progression
- **Keyword Found** → Next stage executes immediately
- **No Keyword** → Keeps polling until timeout (5 min default)
- **Timeout** → Workflow fails with timeout error

## 🎯 WHY This Mechanism Exists

### Problem It Solves
**How do you coordinate multiple AI instances working on complex, multi-stage tasks when you don't know how long each stage will take?**

Traditional approaches fail:
- **Fixed delays** → Too short (cuts off work) or too long (inefficient)
- **Human intervention** → Not scalable, defeats automation purpose
- **File watching** → Unreliable, doesn't capture intent/completion

### The Elegant Solution
**Turn Claude's natural language output into workflow control signals.**

Claude instances signal completion by saying specific phrases, which the monitor detects and uses to advance the workflow. This enables:

1. **Variable Timing**: Each stage takes exactly as long as needed
2. **Clear Handoffs**: Explicit completion signals between phases
3. **Fault Tolerance**: Timeouts prevent infinite waits
4. **Natural Language**: No special APIs or protocols needed

## 🚨 CRITICAL IMPLEMENTATION RULES - MEMORIZE THESE

### Rule 1: ALWAYS Include the Exact Trigger Phrase
```bash
# WRONG - workflow will hang forever
"Implement the login feature and let me know when done."

# RIGHT - workflow advances automatically  
"Implement the login feature. WHEN YOU ARE DONE YOU MUST SAY '***LOGIN_IMPLEMENTED***'"
```

### Rule 2: Use Distinctive, Unique Keywords
```bash
# WRONG - might trigger accidentally
"DONE"

# RIGHT - virtually impossible to say accidentally
"***EXECUTE_PHASE_COMPLETE_READY_FOR_COMPARISON***"
```

### Rule 3: Keywords Must Match EXACTLY
```yaml
# In workflow YAML:
trigger_keyword: "***FEATURE_COMPLETE***"

# Claude MUST say exactly this:
"***FEATURE_COMPLETE***"

# NOT "Feature complete" or "***FEATURE COMPLETE***" or "feature_complete"
```

### Rule 4: Place Keywords at Natural Completion Points
```bash
# WRONG - might say keyword before actually finishing
"Say '***DONE***' and then implement the feature."

# RIGHT - keyword comes after all work is complete
"Implement the feature completely. Test it thoroughly. WHEN EVERYTHING WORKS, SAY '***IMPLEMENTATION_VERIFIED***'"
```

## 🔄 Real-World Example: Execute-Compare-Commit

```yaml
# Stage 1: Execute
prompt: |
  Implement user authentication system.
  Include login, logout, and session management.
  Test all functionality thoroughly.
  WHEN COMPLETE SAY "***EXECUTE_FINISHED***"

trigger_keyword: "***EXECUTE_FINISHED***"

# Stage 2: Compare  
prompt: |
  Review the authentication implementation against requirements.
  Identify any gaps or issues.
  Document what needs improvement.
  WHEN ANALYSIS COMPLETE SAY "***COMPARE_FINISHED***"

trigger_keyword: "***COMPARE_FINISHED***"

# Stage 3: Commit
prompt: |
  Clean up code, add documentation, create git commit.
  WHEN COMMITTED SAY "***WORKFLOW_COMPLETE***"

trigger_keyword: "***WORKFLOW_COMPLETE***"
```

## 🚨 WHAT HAPPENS WHEN YOU FORGET

### Scenario: Forgetting the Keyword
1. Workflow sends prompt without trigger phrase
2. Claude completes work perfectly 
3. Keyword monitor polls for 5 minutes
4. **TIMEOUT** - Workflow fails despite successful completion
5. You debug for hours wondering why "the system is broken"

### Scenario: Wrong Keyword
1. Workflow expects "***TASK_COMPLETE***"
2. Claude says "***TASK_FINISHED***" 
3. Monitor never detects keyword
4. **TIMEOUT** - Same frustrating debug session

### Scenario: Keyword Too Generic  
1. Claude naturally says "done" while explaining something
2. Workflow advances prematurely to next stage
3. **LOGIC ERROR** - Later stages fail because work wasn't actually complete

## 💡 DEBUGGING KEYWORDS - Essential Commands

### Check if instance is still alive:
```bash
tmux ls | grep claude_
```

### See what Claude actually said:
```bash
node ../scripts/mcp_bridge.js read '{"instanceId": "spec_1_1_XXXXX", "lines": 50}'
```

### Check workflow expectations vs reality:
```bash
# Look in workflow YAML for trigger_keyword
# Compare with actual Claude output
```

## 🎯 THE ULTIMATE RULE

**Every workflow prompt MUST end with an unambiguous, unique trigger phrase that Claude will say when the task is genuinely complete.**

This is not optional. This is not a suggestion. This is the fundamental mechanism that makes autonomous multi-stage AI workflows possible.

**NEVER FORGET: No keyword = No workflow progression = System appears broken but it's user error.**

---

*This mechanism enables the Execute-Compare-Commit pattern and all advanced workflow orchestration. Master this, and you master the entire system.*