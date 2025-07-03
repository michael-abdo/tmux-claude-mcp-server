# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-07-03

### Code Consolidation
- **REMOVED ~300+ lines of duplicate code** across multiple modules
- **Consolidated validation logic**: Extracted 20+ duplicate validation patterns into shared `src/utils/validation.js` utility
- **Consolidated tmux operations**: Refactored scripts to use canonical `TmuxInterface` instead of duplicate `execSync` calls
- **Consolidated git operations**: Eliminated direct git command usage in favor of canonical `GitBranchManager`
- **Consolidated CLAUDE.md generation**: Removed duplicate implementations in `InstanceManager` and `Phase1SimpleMode`, standardized on `claude_md_builder.js`
- **Consolidated directory creation**: Standardized all directory operations to use `fs-extra` library consistently

### Why Consolidated
- **Maintainability**: Single source of truth for each operation type reduces bugs and makes updates easier
- **Consistency**: Unified error handling and behavior patterns across the entire codebase
- **Performance**: Eliminated redundant code paths and simplified import graphs
- **Testing**: Fewer code paths to test and validate

### Files Impacted
- `src/utils/validation.js` (created as canonical validation utility)
- `src/mcp_tools.js` (refactored to use shared validation)
- `scripts/send_enter_to_all.js` (refactored to use TmuxInterface)
- `scripts/check/check_session.js` (refactored to use TmuxInterface)
- `src/shared_workspace_ai_integration.js` (refactored to use GitBranchManager)
- `src/ai_conflict_resolver.js` (refactored to use GitBranchManager)
- `src/instance_manager.js` (removed 170+ line buildClaudeContext, uses buildClaudeMd)
- `src/phase1_simple_mode.js` (removed 30+ line buildClaudeContext, uses buildClaudeMd)
- `src/role_templates/role_template_manager.js` (standardized on fs-extra)
- `src/mcp_config_generator.js` (standardized on fs-extra)
- `scripts/spawn_website_executive.js` (standardized on fs-extra)

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