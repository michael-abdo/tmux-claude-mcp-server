# Scripts

Utility scripts for managing and testing tmux-claude-mcp-server.

## Available Scripts

### Instance Management

#### `spawnTestExecutive.js`
Spawns a test executive instance with sample project requirements.
```bash
node scripts/spawnTestExecutive.js
```

#### `cleanupTestInstances.js`
Cleans up all test instances and their tmux sessions.
```bash
node scripts/cleanupTestInstances.js
```

#### `shutdown_instances.js`
Provides targeted shutdown commands for different instance types.
```bash
# Shutdown specific instance types
node scripts/shutdown_instances.js specialists
node scripts/shutdown_instances.js managers
node scripts/shutdown_instances.js executive
node scripts/shutdown_instances.js all

# List active instances
node scripts/shutdown_instances.js list

# Show help
node scripts/shutdown_instances.js help
```

### Monitoring

#### `monitorExecutive.js`
Monitors an executive instance and displays progress.
```bash
node scripts/monitorExecutive.js <instanceId>
```

#### `monitorTestExecutive.js`
Monitors test executive instances with enhanced output.
```bash
node scripts/monitorTestExecutive.js
```

#### `watchTmux.sh`
Watches tmux sessions for activity (useful for debugging).
```bash
./scripts/watchTmux.sh
```

### UI/Demo Scripts

#### `spawnDesktopUiV2.js`
Spawns instances for desktop UI development.
```bash
node scripts/spawnDesktopUiV2.js
```

#### `spawnUiSimpleMode.js`
Spawns UI in simple mode for testing.
```bash
node scripts/spawnUiSimpleMode.js
```

### Communication

#### `instructExecutive.js`
Sends instructions to an executive instance.
```bash
node scripts/instructExecutive.js <instanceId> "Your instructions here"
```

#### `mcpBridge.js`
Bridge for external MCP tool access.
```bash
node scripts/mcpBridge.js <command> <params>
```

### Testing

#### `runAllTests.sh`
Runs the complete test suite.
```bash
./scripts/runAllTests.sh
```

## Usage Notes

1. Most scripts require an MCP server to be running
2. Instance IDs follow the pattern: `{role}_{id}`
3. Check `state/instances.json` for active instances
4. Use `cleanupTestInstances.js` to clean up after testing

## Development Scripts

These scripts are primarily for development and testing. In production, use the MCP tools directly through the Claude interface.