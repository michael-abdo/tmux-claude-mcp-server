# tmux-claude MCP Server Documentation

## Overview

This directory contains comprehensive documentation for the tmux-claude MCP Server, covering all phases of implementation from basic MCP functionality to advanced parallel execution capabilities.

## Documentation Index

### ⚠️ CRITICAL: Delegation Rules ⚠️

**ALL EXECUTIVES AND MANAGERS MUST DELEGATE**
- Executives delegate to Managers
- Managers delegate to Specialists  
- NO direct implementation allowed
- See [DELEGATION_PATTERNS.md](DELEGATION_PATTERNS.md) for mandatory patterns
- See [user_guide_orchestration.md](user_guide_orchestration.md) for orchestration guide

### Core Documentation

1. **[MCP_CONFIGURATION_GUIDE.md](MCP_CONFIGURATION_GUIDE.md)** ⚠️ **READ FIRST**
   - CRITICAL: How to configure MCP server globally
   - User-scoped vs project-scoped configuration
   - Common issues and solutions
   - Technical details for LLMs

2. **[README_PHASE3.md](../README_PHASE3.md)**
   - Complete Phase 3 architecture overview
   - Parallel execution capabilities
   - Advanced features and usage examples

3. **[TEST_RESULTS.md](../TEST_RESULTS.md)**
   - Comprehensive test results
   - All test suites and their outcomes
   - Performance benchmarks

### Operational Guides

3. **[REDIS_BEST_PRACTICES.md](REDIS_BEST_PRACTICES.md)**
   - Redis installation and configuration
   - Performance optimization tips
   - High availability setup
   - Security best practices
   - Monitoring and troubleshooting

4. **[TROUBLESHOOTING_PARALLEL.md](TROUBLESHOOTING_PARALLEL.md)**
   - Common issues and solutions
   - Debugging techniques
   - Performance troubleshooting
   - Recovery procedures
   - Prevention best practices

### API Documentation

5. **MCP Tools Reference**
   - `spawn(role, workDir, context, parentId)` - Create Claude instances
   - `send(instanceId, text)` - Send messages to instances
   - `read(instanceId, lines)` - Read output from instances
   - `list(role, parentId)` - List active instances
   - `terminate(instanceId, cascade)` - Stop instances

6. **Enhanced MCP Tools (Phase 3)**
   - `executeParallel(managerId, tasks, workDir)` - Run tasks in parallel
   - `distributeWork(tasks, strategy)` - Distribute work across Managers
   - `getParallelStatus(managerId)` - Check parallel execution status

### Dashboards

7. **Monitoring Dashboard**
   - URL: `http://localhost:3000`
   - Real-time instance monitoring
   - Performance metrics
   - System health checks

8. **Executive Dashboard**
   - URL: `http://localhost:3000/executive`
   - Job orchestration control
   - KPI tracking
   - Manager load distribution
   - Job pipeline visualization

## Critical Setup Requirement

**BEFORE USING ANY FEATURES**, you MUST configure the MCP server globally:

```bash
claude mcp add tmux-claude -s user node /path/to/tmux-claude-mcp-server/src/simple_mcp_server.js
```

**See [MCP_CONFIGURATION_GUIDE.md](MCP_CONFIGURATION_GUIDE.md) for detailed instructions.**

## Quick Start Commands

```bash
# Install dependencies
npm install

# Configure MCP (REQUIRED - see above)
claude mcp add tmux-claude -s user node /path/to/tmux-claude-mcp-server/src/simple_mcp_server.js

# Verify MCP configuration
claude mcp list

# Run basic tests
npm test

# Run Phase 3 tests
npm run test:phase3

# Start monitoring dashboard
npm run dashboard

# Run performance benchmark
npm run benchmark

# Run load test
npm run test:load

# Test auto-recovery
npm run test:recovery
```

## Architecture Diagrams

### Phase 1 - Basic MCP
```
Claude CLI → MCP Server → tmux → Claude Instance
```

### Phase 2 - Hierarchical with MCP
```
Executive (Claude)
    ↓ MCP
Manager (Claude)
    ↓ MCP
Specialist (Claude)
```

### Phase 3 - Parallel Execution
```
Executive (Claude)
    ↓ MCP
[Manager 1] [Manager 2] [Manager 3]
    ↓ ↓ ↓     ↓ ↓ ↓     ↓ ↓ ↓
[S1][S2][S3] [S4][S5][S6] [S7][S8][S9]

All coordinated via Redis state store
```

## Key Features by Phase

### Phase 1 (MVP)
- Basic tmux session management
- Simple instance lifecycle
- Sequential execution only
- JSON state storage

### Phase 2 (MCP Integration)
- Full MCP server implementation
- Hierarchical instance management
- Role-based access control
- External state store

### Phase 3 (Parallel Execution)
- 10+ concurrent instances
- Redis-backed distributed state
- Job queue with priorities
- Health monitoring & auto-recovery
- Circuit breaker pattern
- Auto-scaling capabilities
- Distributed tracing
- Performance benchmarking
- Executive & monitoring dashboards

## Environment Variables

```bash
# Phase selection
PHASE=3                    # Enable Phase 3 features

# Redis configuration
REDIS_URL=redis://localhost:6379

# Concurrency limits
MAX_MANAGER_CONCURRENCY=5
MAX_SPECIALISTS_PER_MANAGER=4

# Tracing
ENABLE_TRACING=true
TRACE_SAMPLING=0.1         # 10% sampling

# Dashboard
PORT=3000                  # Dashboard server port
```

## Support

For issues, questions, or contributions:
1. Check the troubleshooting guide
2. Review test results for examples
3. Use the monitoring dashboard for diagnostics
4. Enable distributed tracing for debugging

## License

MIT License - See LICENSE file for details