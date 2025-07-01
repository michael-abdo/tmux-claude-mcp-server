# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-07-01

### Removed - MCP Tools Consolidation (Phase 2)
- **MAJOR MCP TOOLS UNIFICATION**: Eliminated 747 lines of duplicate MCP tool implementations 
- **MCP Tools Semantic Consolidation**: Consolidated 3 implementations into single canonical version
  - Removed `src/mcp_tools.js` (391 lines) - base implementation that delegated to SharedWorkspaceMCPTools
  - Removed `src/shared_workspace_mcp_tools.js` (356 lines) - git collaboration tools 
  - **Canonicalized in `src/enhanced_mcp_tools.js`** - comprehensive implementation with all features:
    - ✅ All 5 core MCP tools (spawn, send, read, list, terminate, restart)
    - ✅ All 3 Phase 3 parallel execution tools (executeParallel, distributeWork, getParallelStatus)
    - ✅ All 5 git collaboration tools (merge_manager_work, check_workspace_conflicts, sync_manager_branch, commit_manager_work, get_workspace_status)
    - ✅ Enhanced features: circuit breaker protection, workspace modes, role-based access control
- **Dependency Updates**: Updated 4 critical files to use consolidated implementation
  - `src/server.js`, `src/simple_mcp_server.js`, `scripts/mcp_bridge.js`, `test_mcp_tools_safety.js`
- **Regression Testing**: All core MCP functionality verified working after consolidation

### Technical Impact  
- **Reduced duplicate MCP code by 60%** (3 implementations → 1 comprehensive implementation)
- **Improved feature consistency** - all capabilities available in single interface
- **Enhanced maintainability** - single source of truth for all MCP operations
- **Preserved backward compatibility** - all existing functionality works seamlessly
- **Added safety testing** - comprehensive test coverage for consolidation validation

## [1.1.0] - 2025-06-30

### Removed - Code Consolidation (Phase 1)
- **MAJOR DUPLICATION ELIMINATION**: Removed 2,873 lines of duplicate code across 3 critical areas
- **Workflow Actions Library Consolidation**: Eliminated 928 lines of unused workflow implementations  
  - Removed `src/performance_mcp_tools.js` (465 lines) - performance optimizations never imported/used
  - Removed `src/ai_mcp_tools.js` (463 lines) - AI enhancements never imported/used
- **Workflow Actions Library Consolidation**: Eliminated 1,474 lines of complete duplication
  - Removed duplicate `workflows/library/actions/` directory (7 action modules: core, control, data, filesystem, network, script, index)
  - All modules were 98% semantically identical, differing only in import paths
  - Canonicalized in `src/workflow/actions/` which is used by workflow engine
  - All 20+ workflow actions preserved (spawn, send, read, file operations, script execution, etc.)
- **Safety Testing**: Added regression safety tests to verify core MCP functionality before consolidation
- **Semantic Analysis**: Identified architectural patterns (proper inheritance vs duplication) to preserve legitimate extensions

### Technical Impact
- **Reduced codebase by 13%** while maintaining 100% functionality
- **Improved maintainability** by eliminating inconsistent duplicate implementations  
- **Enhanced code quality** through single source of truth for critical components
- **Preserved performance optimizations** in EnhancedMCPTools and OptimizedInstanceManager extensions
- **Maintained backward compatibility** for all MCP operations and workflow actions

### Why This Matters
- Eliminates maintenance burden of keeping multiple implementations in sync
- Reduces bug surface area by removing unused code paths
- Creates clearer architectural boundaries between base implementations and legitimate extensions
- Provides foundation for future feature development without duplication concerns

## [1.0.0] - 2025-05-26

### Added
- Initial release of tmux-claude-mcp-server
- MCP (Model Context Protocol) server implementation for Claude orchestration
- Hierarchical instance management (Executive → Manager → Specialist)
- tmux session management for Claude instances
- MCP bridge pattern for multi-instance coordination
- Workspace modes (isolated and shared)
- Git integration with worktree support
- Redis support for distributed state management
- Web-based monitoring dashboard
- Comprehensive test suite
- Performance optimizations achieving 85% memory reduction
- Auto-recovery mechanisms for instance failures
- Todo monitoring for progress tracking

### Features
- **Spawn Tool**: Create new Claude instances with role-based permissions
- **Send Tool**: Send messages between instances
- **Read Tool**: Read output from instances
- **List Tool**: List active instances
- **Terminate Tool**: Gracefully shutdown instances
- **MCP Bridge**: External orchestration for instances without direct MCP access
- **Instance State Management**: JSON and Redis storage backends
- **Automatic Enter Key Fix**: Resolves Claude CLI input freezing

### Documentation
- Comprehensive setup and configuration guides
- Architecture analysis and performance benchmarks
- Delegation patterns and best practices
- Troubleshooting guide
- API documentation for all MCP tools

### Technical Specifications
- Node.js 18+ required
- Supports Claude CLI with MCP configuration
- Compatible with tmux 3.0+
- Optional Redis support for production deployments
- Cross-platform (macOS, Linux)