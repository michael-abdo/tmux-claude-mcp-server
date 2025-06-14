# Workflow System Tests

This directory contains simple test workflows to verify the workflow system is working correctly.

## Running Tests

### All Tests
```bash
npm run workflow:test
```

### Individual Tests
```bash
# Test 1: Minimal workflow (logging only)
npm run workflow:test:minimal

# Test 2: Script execution
npm run workflow:test:script

# Test 3: File operations
npm run workflow:test:files
```

## Test Workflows

### 1. `test_minimal.yaml`
- **Purpose**: Simplest possible test
- **Tests**: Basic prompt → keyword → action flow
- **Duration**: ~30 seconds
- **Actions**: Just logging

### 2. `test_script.yaml` 
- **Purpose**: Test script execution and variable passing
- **Tests**: `run_script` action with output capture
- **Duration**: ~60 seconds
- **Actions**: `echo` command, variable interpolation

### 3. `test_file_ops.yaml`
- **Purpose**: Test file creation, reading, and cleanup
- **Tests**: `save_file`, `read_file`, and cleanup
- **Duration**: ~60 seconds
- **Actions**: File I/O operations within workflows directory

## What Gets Tested

✅ **Core Workflow Engine**
- YAML parsing and validation
- Stage execution and transitions
- Keyword detection and monitoring

✅ **Action System** 
- `log`: Message logging
- `run_script`: Command execution
- `save_file`: File creation
- `read_file`: File reading
- `complete_workflow`: Proper termination

✅ **Context System**
- Variable interpolation (`${variable}`)
- Output capture and storage
- Cross-stage data passing

✅ **Error Handling**
- Timeout management
- Graceful cleanup
- Failure continuation

## Expected Output

Each test should:
1. Start the workflow engine
2. Execute all stages successfully  
3. Display progress logs
4. Complete with "Workflow completed successfully!"
5. Exit with code 0

## Troubleshooting

If tests fail:

1. **Check dependencies**: `npm install`
2. **Verify MCP bridge**: `node scripts/mcp_bridge.js list '{}'`
3. **Check permissions**: Ensure scripts are executable
4. **Review logs**: Look for error messages in output
5. **Manual test**: Run workflows individually to isolate issues

## File Locations

All test files are contained within:
```
/Users/Mike/.claude/user/tmux-claude-mcp-server/workflows/
├── test_minimal.yaml
├── test_script.yaml  
├── test_file_ops.yaml
├── run_tests.sh
└── TEST_README.md
```

No files are created outside this directory except temporary workflow state in `workflow_state/`.