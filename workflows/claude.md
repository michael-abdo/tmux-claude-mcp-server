# Claude Autonomous Workflow Execution Constraints

## Non-Negotiable Constraints

### 1. Input Constraint
- The input to the system must always be clearly defined and unambiguous
- Must use current workflow structure

### 2. Output Constraint  
- The output of the system must exactly match the predefined format, with zero deviations
- Must work with run_integration_tests.js

### 3. Throughput Constraint
- The internal calculation process (throughput) must use explicitly defined methods without exception
- Must run using REAL tmux instances and REAL yaml files
- Cannot SIMULATE anything
- Must be live production ready

## Senior Engineer Validation Protocol

### Critical Understanding: Test Reality, Not Testing Infrastructure

**The Core Problem:** Testing that our tests run vs. testing that the system actually works
**Senior Engineer Principle:** Validate EVERYTHING - take two steps forward, one step back

### Real Testing Criteria (100% Accuracy)

#### Layer 1: Foundation Validation (MUST PASS to proceed)
```
1. MCP Bridge Works
   - Can list tmux sessions ✓
   - Can create specialist instances ✓  
   - Can communicate with instances ✓
   - Returns valid instance IDs ✓

2. Workflow Engine Core
   - Can parse YAML without errors ✓
   - Can initialize workflow process ✓
   - Can start first stage ✓
   - Produces structured output ✓
```

#### Layer 2: Automatic Orchestration Validation (The Real Test)
```
3. Keyword-Driven Transitions
   - Workflow creates its own instances ✓
   - Detects EXECUTE_FINISHED keyword ✓
   - Automatically advances to Compare stage ✓
   - No manual intervention required ✓

4. Complete End-to-End Automation
   - Execute → Compare → Commit progression ✓
   - Each transition under 30 seconds ✓
   - Total completion under 2 minutes ✓
   - No human intervention anywhere ✓
```

### Test Failure Patterns (What NOT to Accept)
```
❌ "Workflow started" (without proving it can complete)
❌ "MCP bridge responds" (without proving it creates instances)  
❌ "Captured output" (without proving automatic behavior)
❌ "Infrastructure works" (without proving orchestration works)
```

### Test Success Criteria (100% Validation)
```
✅ MCP bridge creates real tmux instances with real Claude sessions
✅ Workflow automatically progresses Execute → Compare → Commit  
✅ Keyword detection triggers automatic stage transitions
✅ Complete orchestration runs without manual intervention
✅ Timing proves automation (transitions under 30 seconds)
```

## Operational Procedure

### Step 1: Reload Constraints
- Begin each cycle by reloading this "claude.md" file to ensure constant awareness of the constraints

### Step 2: Execute Foundation Validation
- Prove MCP bridge actually creates instances
- Prove workflow engine can parse YAML and start stages
- **DO NOT PROCEED** until foundation layer passes

### Step 3: Execute Automatic Orchestration Tests
- Test keyword-driven stage transitions
- Test complete end-to-end automatic flow
- Measure timing to prove automation

### Step 4: Validate Real System Behavior
- Compare actual workflow behavior against expected automatic orchestration
- Verify Execute → Compare → Commit happens automatically
- Confirm no manual intervention required

### Step 5: Diagnose and Reflect (Senior Engineer Approach)
- If foundation fails: Fix MCP bridge and workflow engine first
- If orchestration fails: System lacks automatic behavior - manual intervention required
- Document precisely what works vs. what requires manual steps

### Step 6: Implement Real Fixes
- Foundation issues: Fix dependencies, paths, permissions
- Orchestration issues: Implement automatic stage progression logic
- Never accept "testing infrastructure works" as success

### Step 7: Repeat Until Real Validation
- Re-execute until automatic orchestration is proven, not just testable
- Success = system runs Execute → Compare → Commit automatically
- Failure = any manual intervention required

## Success Criteria

The solution and success are found by proving these three layers work:
- **Foundation Layer**: MCP bridge and workflow engine function correctly
- **Orchestration Layer**: Automatic stage transitions without human intervention  
- **Integration Layer**: Complete Execute → Compare → Commit flow in under 2 minutes

## Absolute Rule

NEVER accept "testing infrastructure works" as proof that "automatic orchestration works."
Test the system behavior, not the ability to test the system behavior.

## CRITICAL TESTING REALIZATION - Navy SEAL Analysis

### The Real Test Requirement

**YOU (Claude) must SIMULATE the human user** to test automatic orchestration:
- Workflow engine spawns Claude instance ✅ (Interface fixed)
- **YOU manually send Execute stage prompt** (simulating human trigger)
- **Workflow engine should automatically detect "EXECUTE_FINISHED" keyword**
- **Workflow engine should automatically send Compare stage prompt**  
- **Workflow engine should automatically detect "COMPARE_FINISHED" keyword**
- **Workflow engine should automatically send Commit stage prompt**
- **Workflow engine should automatically detect "COMMIT_COMPLETE" keyword**

### The Actual Failure Point

Workflow engine spawns Claude successfully, but then **NEVER STARTS THE ORCHESTRATION LOOP**:
- No initial prompt sent automatically
- No keyword monitoring started  
- No stage progression logic activated

### Mission Status: INCOMPLETE

The interface fix was necessary but insufficient. The **core orchestration engine remains untested and likely broken**.

**The grain of sand:** Validating component integration but not autonomous orchestration.

## Senior Engineer Red Flags

🚨 **If you see these, the test is invalid:**
- Workflow starts but never completes automatically
- MCP bridge "responds" but doesn't create real instances
- Test captures output but doesn't prove automatic behavior
- "Success" is actually system failure with graceful error handling
- Complex testing infrastructure around a system that may not work
- **CARGO CULT VALIDATION: Testing components instead of system integration**
- **Claiming "EXECUTE_FINISHED" when automatic orchestration never starts**

🎯 **Real success looks like:**
- Workflow spawns Claude and automatically sends Execute prompt
- Claude responds with EXECUTE_FINISHED → workflow automatically moves to Compare stage
- Claude responds with COMPARE_FINISHED → workflow automatically moves to Commit stage  
- Claude responds with COMMIT_FINISHED → workflow automatically completes
- Total time under 2 minutes, all transitions under 30 seconds
- Zero manual intervention required anywhere in the process

### DO NOT FORGET

**Test the autonomous orchestration that IS the mission, not the ability to manually simulate the orchestration.**