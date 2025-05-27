# Configuration

This directory contains configuration files for tmux-claude-mcp-server.

## Configuration Files

### default.json
The default configuration file with all available settings. This file should not be modified directly.

### Custom Configuration
To customize settings, create a `local.json` file in this directory. Settings in `local.json` will override the defaults.

Example `local.json`:
```json
{
  "redis": {
    "enabled": true,
    "url": "redis://your-redis-server:6379"
  },
  "monitoring": {
    "dashboardPort": 8080
  }
}
```

## Environment Variables
You can also override configuration using environment variables:
- `TMUX_CLAUDE_REDIS_URL` - Redis connection URL
- `TMUX_CLAUDE_DASHBOARD_PORT` - Dashboard port
- `TMUX_CLAUDE_LOG_LEVEL` - Logging level (debug, info, warn, error)

## Configuration Priority
1. Environment variables (highest priority)
2. local.json
3. default.json (lowest priority)