# Claude Code Getting Started Guide

Welcome Claude! This guide will help you understand and work with the tmux-claude-mcp-server project. Follow these steps to get oriented and start working effectively.

## 🚀 Quick Start

### 1. First, understand what you're working with
This is an MCP server that enables hierarchical orchestration of Claude instances via tmux. It allows an Executive Claude to spawn and manage Manager and Specialist Claudes.

### 2. Check your environment
```bash
# Verify you're in the right directory
pwd  # Should be: /Users/Mike/.claude/user/tmux-claude-mcp-server

# Check Node.js is available
node --version  # Should be >= 18.0.0

# Verify tmux is installed
tmux -V
```

### 3. Install dependencies (if needed)
```bash
npm install
```

### 4. Start an Executive instance
```bash
# The simplest way to start
node scripts/spawn_test_executive.js
```

This will:
- Create a new tmux session with an Executive Claude
- Set up the MCP bridge for tool access
- Display the session name (e.g., `exec_001`)

### 5. Monitor the Executive
```bash
# In another terminal or after spawning
node scripts/monitor_executive.js exec_001
```

## 📖 Essential Documentation Map

Based on what you need to do, here's where to look:

### Understanding the Architecture
- **Start here**: `docs/REPOSITORY_STRUCTURE.md` - Understand the codebase layout
- **Core concepts**: `docs/PROJECT_COMPLETION_SUMMARY.md` - High-level system overview
- **MCP Bridge**: `docs/analysis/MCP_ARCHITECTURAL_ANALYSIS.md` - Why we use the bridge pattern

### Working with Instances
- **Spawning**: `docs/DELEGATION_PATTERNS.md` - How to create and manage instances
- **Communication**: `docs/analysis/MCP_BRIDGE_USAGE.md` - How instances talk to each other
- **Workspace modes**: `docs/WORKSPACE_MODES.md` - Isolated vs shared working directories

### Troubleshooting
- **Common issues**: `docs/TROUBLESHOOTING_PARALLEL.md`
- **Enter key fix**: `docs/archive/development/ENTER_KEY_FIX.md` - If instances freeze
- **Performance**: `docs/PERFORMANCE_OPTIMIZATION_GUIDE.md`

## 🛠️ Core Commands You'll Use

### As an Executive Claude
```javascript
// Spawn a Manager
await mcp.spawn({
    role: 'manager',
    task: 'Build a user authentication system',
    parentId: 'exec_001'
});

// Send instructions to a Manager
await mcp.send({
    instanceId: 'mgr_001_001',
    text: 'Please implement the login endpoint first'
});

// Check on all instances
await mcp.list();
```

### Testing and Verification
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:integration
npm run test:e2e

# Check a specific functionality
node tests/integration/basic_test.js
```

## 🎯 Common Tasks

### Task 1: Implement a new feature
1. Read `CONTRIBUTING.md` for code style guidelines
2. Check existing patterns in `src/` directory
3. Write tests in `tests/` following the existing structure
4. Use the TODO system to track your progress

### Task 2: Fix a bug
1. Reproduce the issue using test scripts
2. Check `docs/analysis/` for similar issues
3. Implement fix with minimal changes
4. Add regression test

### Task 3: Understand a specific component
1. Start with the component's README (e.g., `src/README.md`)
2. Look at its tests for usage examples
3. Check integration tests for real-world usage

## ⚡ Performance Considerations

This system uses a bridge pattern that's 85% more memory efficient than spawning multiple MCP servers:
- Single MCP server process (50-70MB)
- Lightweight bridges for each instance
- Centralized state management in Redis

See `docs/analysis/MCP_PERFORMANCE_ANALYSIS.md` for details.

## 🔍 Finding Information

### Use the Documentation Index
Start with `DOCUMENTATION_INDEX.md` which provides a complete map of all documentation.

### Search for specific topics
```bash
# Find all files mentioning a topic
grep -r "spawn" docs/

# Find implementation examples
grep -r "mcp.spawn" tests/
```

### Check test files for examples
Tests often provide the best examples of how to use features:
- `tests/integration/basic_test.js` - Simple usage examples
- `tests/e2e/test_delegation_clean.js` - Full workflow examples

## 🚨 Important Rules

1. **Always use the MCP tools** for inter-instance communication
2. **Never modify** the MCP bridge directly - use the provided interfaces
3. **Follow the delegation pattern** - Executives → Managers → Specialists
4. **Use workspace modes correctly** - Shared for managers working together
5. **Check existing code** before implementing new features

## 💡 Pro Tips

1. **Use the monitoring dashboard**: Start it with `node src/monitoring_dashboard.js`
2. **Enable debug logging**: Set `DEBUG=tmux:*` for detailed logs
3. **Test in isolation**: Use `tests/helpers/test-setup.js` for clean test environments
4. **Read the tests**: They're the most up-to-date documentation

## 🤝 Getting Help

1. **Check existing docs**: Most questions are answered in the documentation
2. **Look at test files**: They show real usage examples
3. **Review closed issues**: Similar problems may have been solved
4. **Ask for clarification**: If something is unclear, ask for specific guidance

## 🎬 Your First Task

Try this simple workflow to get familiar:

```bash
# 1. Start an executive
node scripts/spawn_test_executive.js

# 2. Watch what it does (in another terminal)
tmux attach -t exec_001

# 3. Send it a simple task
node -e "
const { enhancedMCPTools } = require('./src/enhanced_mcp_tools.js');
const tools = enhancedMCPTools();
tools.send({ 
    instanceId: 'exec_001', 
    text: 'Please create a simple test task and delegate it to a manager' 
});
"

# 4. Monitor the results
node scripts/monitor_executive.js exec_001
```

Remember: The codebase is well-tested and documented. When in doubt, check the tests and documentation before making assumptions!

## 📝 Next Steps

1. Read through the core documentation files mentioned above
2. Run the test suite to ensure everything works
3. Try the example workflow
4. Start working on your assigned task

Good luck, and remember to use the empirical testing approach - test your assumptions with real code!