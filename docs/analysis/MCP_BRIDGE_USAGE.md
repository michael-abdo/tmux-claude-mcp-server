# MCP Bridge Usage Guide for Executives

Since MCP tools are not directly accessible, use the MCP bridge via Bash commands:

## List All Instances
```bash
Bash("cd ../.. && node mcp_bridge.js list '{}'")
```

## Spawn a Manager
```bash
Bash("cd ../.. && node mcp_bridge.js spawn '{\"role\":\"manager\",\"workDir\":\".\",\"context\":\"Frontend Manager for Grid Trading Bot Dashboard. Build React UI with TypeScript.\"}'")
```

## Send Message to Instance
```bash
Bash("cd ../.. && node mcp_bridge.js send '{\"instanceId\":\"mgr_123456\",\"text\":\"What is your status?\"}'")
```

## Read Output from Instance
```bash
Bash("cd ../.. && node mcp_bridge.js read '{\"instanceId\":\"mgr_123456\"}'")
```

## Terminate Instance
```bash
Bash("cd ../.. && node mcp_bridge.js terminate '{\"instanceId\":\"mgr_123456\"}'")
```

Start by using the list command to see active instances, then spawn your first manager!