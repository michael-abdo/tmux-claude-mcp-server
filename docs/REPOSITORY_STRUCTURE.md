# Repository Structure

## 📁 Directory Organization

```
tmux-claude-mcp-server/
├── README.md                      # Project overview and quick start
├── DOCUMENTATION_INDEX.md         # Documentation navigation guide
├── PROJECT_COMPLETION_SUMMARY.md  # Project capabilities summary
├── REPOSITORY_STRUCTURE.md        # This file
├── package.json                   # Node.js project configuration
├── package-lock.json             # Locked dependencies
├── .gitignore                    # Git ignore rules
│
├── src/                          # Source code
│   ├── instance_manager.js       # Core instance management
│   ├── tmux_interface.js        # tmux interaction layer
│   ├── mcp_tools.js             # MCP tool implementations
│   ├── simple_mcp_server.js     # Main MCP server
│   └── ...                      # Other source files
│
├── scripts/                      # Utility scripts
│   ├── 🌟 mcp_bridge.js         # Core orchestration layer
│   ├── spawn_test_executive.js  # Spawn test instances
│   ├── cleanup_test_instances.js # Clean up instances
│   └── ...                      # Other scripts
│
├── tests/                        # Test files
│   ├── basic/                   # Basic functionality tests
│   ├── integration/             # Integration tests
│   ├── TEST_RESULTS.md          # Test results
│   └── FINAL_TEST_REPORT.md     # Comprehensive test report
│
├── docs/                         # Documentation
│   ├── README.md                # Documentation index
│   ├── 🌟 ORCHESTRATION_LAYER.md # Bridge architecture guide
│   ├── MCP_CONFIGURATION_GUIDE.md # Setup guide
│   ├── analysis/                # Technical analysis
│   │   └── ...                  # Architecture docs
│   └── archive/                 # Historical documentation
│       ├── development/         # Development history
│       ├── implementation/      # Implementation docs
│       ├── analysis/           # Old analysis
│       └── status/             # Progress reports
│
├── state/                        # Runtime state (git ignored)
│   └── instances.json          # Active instance registry
│
└── logs/                         # Runtime logs (git ignored)
```

## 🚫 Git Ignored

The following are excluded from version control:
- `node_modules/` - Dependencies
- `state/` - Runtime instance state
- `logs/` - Application logs
- `experimental/` - Test/experimental code
- `test-*/` - Test directories
- `*.log` - Log files
- `*.jsonl` - JSON line files
- `.DS_Store` - macOS metadata

## 🎯 Key Files

- **README.md** - Start here for project overview
- **DOCUMENTATION_INDEX.md** - Navigate all documentation
- **scripts/mcp_bridge.js** - Core orchestration layer for Claude instances
- **docs/ORCHESTRATION_LAYER.md** - Understand the bridge architecture
- **package.json** - Node.js configuration and scripts
- **src/simple_mcp_server.js** - Main MCP server entry point

## 📦 npm Scripts

```bash
npm start          # Start the MCP server
npm test           # Run all tests
npm run test:basic # Run basic tests only
```