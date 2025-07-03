# MCP Bridge Test Suite

Comprehensive test suite for the MCP Bridge orchestration layer.

## Test Categories

### 1. Unit Tests (`test_mcp_bridge.js`)
Tests core bridge functionality without spawning real instances:
- Command validation
- Parameter validation
- JSON response format
- Error handling
- State file operations

### 2. Integration Tests (`test_bridge_orchestration.js`)
Tests real orchestration flows with actual instances:
- Spawn and list operations
- Send and read message flow
- Parent-child relationships
- Terminate cascade
- Concurrent operations
- Basic error scenarios

### 3. End-to-End Tests (`test_bridge_hierarchy.js`)
Tests complete Executive → Manager → Specialist orchestration:
- Executive spawning with bridge knowledge
- Managers using bridge to spawn specialists
- Multi-level communication
- Hierarchy validation
- Coordinated shutdown

### 4. Error Scenario Tests (`test_bridge_error_scenarios.js`)
Tests bridge resilience and error handling:
- Invalid JSON parameters
- Missing required parameters
- Invalid instance IDs
- Non-existent instances
- State file corruption
- Concurrent modifications
- Recovery after errors

### 5. Stress Tests (`test_bridge_stress.js`)
Tests system limits and performance:
- Concurrent spawn operations
- High-frequency list operations
- Mixed concurrent operations
- Rapid-fire messaging
- Spawn-and-operate sequences

## Running Tests

### Run All Tests
```bash
npm run test:bridge
```

### Run Individual Test Suites
```bash
# Unit tests only
npm run test:bridge:unit

# Integration tests
npm run test:bridge:integration

# End-to-end hierarchy test
npm run test:bridge:e2e

# Error scenarios
npm run test:bridge:errors

# Stress tests (light)
npm run test:bridge:stress

# Stress tests (heavy)
npm run test:bridge:stress:heavy
```

### Quick Demo
```bash
# Run the bridge example demo
npm run bridge:demo
```

## Test Configuration

### Stress Test Levels
- **Light**: 5 instances, 10 operations, 2 concurrent
- **Medium**: 10 instances, 50 operations, 5 concurrent
- **Heavy**: 20 instances, 100 operations, 10 concurrent

### Timeouts
- Instance initialization: 5-8 seconds
- Message processing: 3 seconds
- Command execution: 30 seconds max

## Test Output

Tests produce:
- Console output with pass/fail status
- Detailed error messages
- Performance metrics (stress tests)
- Log files in `logs/test-results/`

## Writing New Tests

### Test Structure
```javascript
// Helper to run bridge commands
async function bridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    const { stdout } = await execAsync(cmd, {
        cwd: path.join(process.cwd())
    });
    return JSON.parse(stdout);
}

// Example test
async function testExample() {
    // Spawn instance
    const result = await bridge('spawn', {
        role: 'manager',
        workDir: '/tmp/test',
        context: 'Test manager',
        parentId: null
    });
    
    // Verify success
    if (!result.success) {
        throw new Error('Spawn failed');
    }
    
    // Cleanup
    await bridge('terminate', { instanceId: result.instanceId });
}
```

### Best Practices
1. Always cleanup spawned instances
2. Use descriptive test names
3. Test both success and failure cases
4. Include performance metrics where relevant
5. Handle async operations properly

## Troubleshooting

### Common Issues

1. **Tests fail with "command not found"**
   - Ensure you're running from the project root
   - Check that `scripts/mcp_bridge.js` exists

2. **Instances not terminating**
   - Check `tmux list-sessions` for orphaned sessions
   - Use `scripts/cleanup_test_instances.js` if needed

3. **State file errors**
   - Check `state/instances.json` for corruption
   - Delete the file to reset state

4. **Timeout errors**
   - Increase timeouts for slower systems
   - Check system resources (CPU, memory)

## Continuous Integration

These tests are designed to run in CI environments:
- Exit codes indicate success (0) or failure (1)
- Console output is CI-friendly
- Tests clean up after themselves
- Configurable stress levels for different environments