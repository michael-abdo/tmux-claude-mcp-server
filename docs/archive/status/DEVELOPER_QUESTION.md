# Question for MCP Developers

## Context (3 sentences)
We're building a hierarchical orchestration system where a primary Claude instance spawns additional Claude instances via tmux to create an executive→manager→specialist workflow. We discovered that while the primary Claude instance has access to MCP tools, spawned Claude instances (even with identical configuration files and environment variables) report no MCP tool access. Our testing shows this is due to the stdio communication model creating a 1:1 parent-child relationship between Claude and MCP servers.

## Core Question
**Is there a supported way for multiple Claude instances to access the same MCP server, or is the current stdio-based architecture fundamentally limited to single-instance access per MCP server?**

## Additional Context
- We've tested with proper settings.json configuration in each instance directory
- Environment variables are set correctly (CLAUDE_CODE_ENTRYPOINT=cli, CLAUDECODE=1)
- All instances launch successfully but only the primary has MCP tool access
- We're currently using a Node.js bridge workaround that works but isn't native

If multi-instance MCP access isn't currently supported, are there plans to enable it through socket-based communication, server discovery, or other mechanisms?