# Workflow Orchestration Testing - Senior Engineer Protocol

**Project-local testing for automatic workflow orchestration validation**

## Quick Start

```bash
# Run complete validation
cd /home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows
node testing/run_validation.js

# Or use npm scripts
npm test
npm run validate
```

## Project Structure

```
/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/
├── claude.md                              # Senior Engineer constraints & protocol
├── package.json                           # Dependencies
├── testing/
│   ├── run_validation.js                  # Main test runner
│   ├── real_orchestration_validator.js    # Core validator
│   └── orchestration_validation_*.json    # Test reports
└── README.md                              # This file
```

## Senior Engineer Validation Protocol

### Core Principle
**Test actual system behavior, not testing infrastructure**

### Validation Layers

#### Layer 1: Foundation Validation (Must Pass)
- ✅ MCP Bridge can create real tmux instances
- ✅ Workflow Engine can parse YAML and start stages
- ✅ Communication between components works

#### Layer 2: Orchestration Validation (The Real Test)
- ✅ Keyword-driven automatic stage transitions
- ✅ Complete Execute → Compare → Commit flow
- ✅ Timing proves automation (under 30 seconds per transition)

### Success Criteria

**100% Accuracy = Automatic Orchestration Works**
- Send EXECUTE_FINISHED → workflow automatically moves to Compare stage
- Send COMPARE_FINISHED → workflow automatically moves to Commit stage  
- Send COMMIT_FINISHED → workflow automatically completes
- Total time under 2 minutes, all transitions under 30 seconds
- Zero manual intervention required anywhere

**<100% Accuracy = System Needs Implementation Work**
- Foundation issues: Fix MCP bridge and workflow engine
- Orchestration issues: Implement automatic stage progression logic

## Red Flags (Invalid Tests)

🚨 **Do NOT accept these as success:**
- "Workflow started" (without proving it can complete)
- "MCP bridge responds" (without proving it creates instances)  
- "Test captures output" (without proving automatic behavior)
- "Infrastructure works" (without proving orchestration works)

## Commands

```bash
# Full validation
node testing/run_validation.js validate

# Help
node testing/run_validation.js help

# Using npm
npm run validate
npm run help
```

## Closed Feedback Loop

```
claude.md (constraints) → run_validation.js → real_orchestration_validator.js → results → claude.md
```

Each test cycle:
1. Reloads constraints from `claude.md`
2. Validates foundation layer first
3. Tests automatic orchestration behavior
4. Reports real accuracy percentage
5. Provides specific implementation guidance

## Senior Engineer Insights

- **15+ years experience principle**: Validate EVERYTHING
- **Two steps forward, one step back**: Foundation before orchestration
- **No false positives**: Only accept real automatic behavior
- **Actionable results**: Clear guidance on what needs fixing

---

**Remember**: Fix the system to pass the tests, not the tests to pass the system.