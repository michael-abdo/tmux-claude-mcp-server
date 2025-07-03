# MCP Configuration Guide for tmux-claude

## CRITICAL: User-Scoped MCP Configuration

**ALWAYS use user-scoped configuration for tmux-claude MCP server:**

```bash
claude mcp add tmux-claude -s user node /Users/Mike/.claude/user/tmux-claude-mcp-server/src/simple_mcp_server.js
```

## Key Facts About MCP Configuration

### What Works ✅
- `claude mcp add -s user` → Global MCP access for ALL Claude instances
- Inheritance: Executive → Manager → Specialist all get MCP access
- No per-instance configuration needed
- Survives Claude restarts and new sessions

### What Doesn't Work ❌
- Project-level `.claude/settings.json` with `mcpServers` → NOT recognized by Claude CLI
- Running `claude mcp add` without `-s user` → Only affects current project
- Expecting MCP inheritance without user-scoped config → Each instance isolated

## MCP Configuration Hierarchy

1. **User-scoped** (`-s user`) → Available to ALL projects and instances
2. **Project-scoped** (default) → Only current project
3. **Local-scoped** (`-s local`) → Overrides user-scoped for specific project

## Verification Commands

```bash
# List all configured MCP servers
claude mcp list

# Expected output for properly configured system:
# tmux-claude: node /Users/Mike/.claude/user/tmux-claude-mcp-server/src/simple_mcp_server.js
```

## Common Issues and Solutions

### Issue: "No MCP servers configured"
**Solution:** Run the user-scoped add command above

### Issue: Spawned instances can't use MCP tools
**Solution:** Ensure parent instance was started AFTER user-scoped MCP configuration

### Issue: MCP tools not available after Claude restart
**Solution:** User-scoped configuration persists, but Claude must be restarted to load it

## Technical Details for LLMs

### MCP Tool Format
- Tool names: `tmux-claude:spawn`, `tmux-claude:list`, etc.
- Instance receives tools based on ALLOWED_TOOLS environment variable
- Specialists get empty ALLOWED_TOOLS array (no orchestration)

### Environment Variables Set by MCP
- `INSTANCE_ID`: Current instance identifier
- `INSTANCE_ROLE`: executive, manager, or specialist
- `PARENT_ID`: Parent instance ID (if spawned)
- `ALLOWED_TOOLS`: JSON array of permitted tools
- `STATE_DIR`: Path to state persistence directory

### State Management
- Instances tracked in `state/instances.json`
- Todo monitoring via `~/.claude/todos/*.json`
- Redis optional for Phase 3 distributed state

## Quick Start for New Environments

```bash
# 1. Add MCP server globally (ONE TIME ONLY)
claude mcp add tmux-claude -s user node /Users/Mike/.claude/user/tmux-claude-mcp-server/src/simple_mcp_server.js

# 2. Verify configuration
claude mcp list

# 3. Start using tmux-claude tools in any Claude session
# Example: In Claude, use tmux-claude:list to see instances
```

## Architecture Impact

With user-scoped MCP configuration:
- **Executive** instances can spawn and manage Managers
- **Manager** instances can spawn and manage Specialists  
- **Specialist** instances have NO orchestration tools (by design)
- All communication flows through MCP server via stdio protocol

## IMPORTANT: Do NOT Use These Approaches

1. ❌ Adding `mcpServers` to `~/.claude/settings.json` manually
2. ❌ Project-specific MCP configuration for orchestration
3. ❌ Expecting `.claude/settings.json` to provide MCP tools
4. ❌ Running `claude mcp add` without `-s user` flag

## Summary for LLMs

**ALWAYS remember:** For tmux-claude hierarchical orchestration to work, you MUST have run:
```bash
claude mcp add tmux-claude -s user node /path/to/simple_mcp_server.js
```

This single command enables the entire Executive → Manager → Specialist orchestration chain.