# Source Code

This directory contains the core source code for tmux-claude-mcp-server.

## Core Modules

### Instance Management
- `instanceManager.js` - Main instance lifecycle management
- `optimizedInstanceManager.js` - Performance-optimized instance manager
- `instanceManagerFactory.js` - Factory for creating instance managers

### MCP Tools
- `mcpTools.js` - Core MCP tool implementations
- `enhancedMcpTools.js` - Enhanced MCP tools with circuit breaking
- `performanceMcpTools.js` - Performance-optimized MCP tools
- `simpleMcpServer.js` - Main MCP server entry point

### tmux Integration
- `tmuxInterface.js` - Low-level tmux command interface
- `reliableTmuxSender.js` - Reliable message sending with retries

### Git Integration
- `gitBranchManager.js` - Git branch management
- `atomicGitOperations.js` - Atomic git operations
- `sharedWorkspaceGitManager.js` - Shared workspace git management

### Monitoring & Performance
- `performanceMonitor.js` - Performance monitoring
- `performanceOptimizer.js` - Performance optimization strategies
- `healthMonitor.js` - Instance health monitoring
- `monitoringDashboard.js` - Web dashboard
- `todoMonitor.js` - Todo list monitoring

### Orchestration
- `orchestration/` - Orchestration components
  - `executiveOrchestrator.js` - Executive orchestration logic
  - `managerCoordinator.js` - Manager coordination
  - `monitorProgress.js` - Progress monitoring
  - `spawnHelpers.js` - Instance spawning helpers

### State Management
- `redisStateStore.js` - Redis-based state storage
- `project/projectState.js` - Project state management

### Utilities
- `circuitBreaker.js` - Circuit breaker pattern
- `distributedTracer.js` - Distributed tracing
- `autoScaler.js` - Auto-scaling logic
- `parallelExecutor.js` - Parallel execution
- `aiConflictResolver.js` - AI-powered conflict resolution
- `mcpConfigGenerator.js` - MCP configuration generation

### Dashboard
- `dashboard/` - Web dashboard files
  - `server.js` - Dashboard server
  - `index.html` - Main dashboard page
  - `executive.html` - Executive view
  - `public/` - Static assets

## Architecture

The codebase follows a modular architecture with clear separation of concerns:

1. **Core** - Instance and tmux management
2. **MCP Layer** - MCP protocol implementation
3. **Integration** - Git, monitoring, AI features
4. **Web** - Dashboard and UI components

## Naming Conventions

- Files: camelCase (e.g., `instanceManager.js`)
- Classes: PascalCase (e.g., `InstanceManager`)
- Functions: camelCase (e.g., `spawnInstance`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)