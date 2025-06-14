# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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