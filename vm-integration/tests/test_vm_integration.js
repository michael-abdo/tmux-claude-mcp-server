#!/usr/bin/env node

/**
 * VM Integration Test Suite
 * 
 * Comprehensive tests for VM management functionality
 * Includes both unit tests and integration tests with AWS mocking
 */

import { VMManager } from '../vm_manager.js';
import { VMMCPTools } from '../vm_mcp_tools.js';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_CONFIG = {
  stateFile: join(__dirname, 'test-vm-state.json'),
  mockMode: process.env.VM_TEST_MOCK !== 'false', // Default to mock mode
  verbose: process.env.VM_TEST_VERBOSE === 'true'
};

/**
 * Mock AWS CLI execution for testing
 */
class MockVMManager extends VMManager {
  constructor(options = {}) {
    super({
      ...options,
      stateFile: TEST_CONFIG.stateFile
    });
    this.mockResponses = new Map();
    this.executionLog = [];
  }

  /**
   * Mock AWS CLI execution
   */
  async executeAWS(command) {
    this.executionLog.push(command);
    
    if (TEST_CONFIG.verbose) {
      console.log(`Mock AWS CLI: ${command.join(' ')}`);
    }

    // Generate mock responses based on command
    if (command.includes('run-instances')) {
      return this.mockRunInstances();
    } else if (command.includes('describe-instances')) {
      return this.mockDescribeInstances();
    } else if (command.includes('terminate-instances')) {
      return this.mockTerminateInstances();
    } else if (command.includes('stop-instances')) {
      return this.mockStopInstances();
    } else if (command.includes('start-instances')) {
      return this.mockStartInstances();
    } else if (command.includes('create-image')) {
      return this.mockCreateImage();
    }

    return { message: 'Mock response' };
  }

  mockRunInstances() {
    return {
      Instances: [{
        InstanceId: `i-${Math.random().toString(36).substr(2, 17)}`,
        State: { Name: 'pending' },
        PrivateIpAddress: '10.0.0.' + Math.floor(Math.random() * 255),
        PublicIpAddress: null
      }]
    };
  }

  mockDescribeInstances() {
    return {
      Reservations: [{
        Instances: [{
          InstanceId: Object.keys(this.state.instances)[0] || 'i-mock123',
          State: { Name: 'running' },
          PrivateIpAddress: '10.0.0.100',
          PublicIpAddress: '54.123.45.67'
        }]
      }]
    };
  }

  mockTerminateInstances() {
    return { message: 'Termination initiated' };
  }

  mockStopInstances() {
    return { message: 'Stop initiated' };
  }

  mockStartInstances() {
    return { message: 'Start initiated' };
  }

  mockCreateImage() {
    return {
      ImageId: `ami-${Math.random().toString(36).substr(2, 17)}`
    };
  }

  // Override wait methods for faster testing
  async waitForInstanceState(instanceId, desiredState) {
    if (TEST_CONFIG.verbose) {
      console.log(`Mock: Instance ${instanceId} reached state ${desiredState}`);
    }
    return { State: { Name: desiredState } };
  }
}

/**
 * Test runner class
 */
class VMTestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  /**
   * Register a test
   */
  test(name, testFn) {
    this.tests.push({ name, fn: testFn });
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('🧪 Running VM Integration Test Suite');
    console.log('═'.repeat(50));
    console.log(`📋 Mode: ${TEST_CONFIG.mockMode ? 'Mock' : 'Live AWS'}`);
    console.log(`📄 Tests: ${this.tests.length}`);
    console.log('');

    for (const test of this.tests) {
      try {
        console.log(`🔍 ${test.name}`);
        await test.fn();
        console.log(`✅ PASSED: ${test.name}`);
        this.passed++;
      } catch (error) {
        console.log(`❌ FAILED: ${test.name}`);
        console.log(`   Error: ${error.message}`);
        if (TEST_CONFIG.verbose && error.stack) {
          console.log(`   Stack: ${error.stack}`);
        }
        this.failed++;
      }
      console.log('');
    }

    await this.cleanup();
    this.printSummary();
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('📊 Test Results');
    console.log('─'.repeat(30));
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`📋 Total: ${this.tests.length}`);
    console.log('');

    if (this.failed === 0) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️  ${this.failed} test(s) failed`);
      process.exit(1);
    }
  }

  /**
   * Cleanup test artifacts
   */
  async cleanup() {
    try {
      await unlink(TEST_CONFIG.stateFile);
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  /**
   * Assert equality helper
   */
  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  }

  /**
   * Assert object contains expected properties
   */
  assertContains(obj, expectedProps, message) {
    for (const [key, value] of Object.entries(expectedProps)) {
      if (obj[key] !== value) {
        throw new Error(message || `Expected ${key}=${value}, got ${key}=${obj[key]}`);
      }
    }
  }
}

// Create test runner
const runner = new VMTestRunner();

// Unit Tests for VMManager
runner.test('VMManager constructor initializes correctly', async () => {
  const vmManager = new MockVMManager();
  runner.assert(vmManager instanceof VMManager, 'VMManager should be instance of VMManager');
  runner.assertEqual(vmManager.provider, 'aws', 'Default provider should be AWS');
  runner.assertEqual(vmManager.region, 'us-east-1', 'Default region should be us-east-1');
});

runner.test('VMManager state persistence works', async () => {
  const vmManager = new MockVMManager();
  
  // Add test instance to state
  const testInstance = {
    instanceId: 'i-test123',
    name: 'test-vm',
    status: 'running'
  };
  
  vmManager.state.instances['i-test123'] = testInstance;
  await vmManager.saveState();
  
  // Create new manager and load state
  const vmManager2 = new MockVMManager();
  await vmManager2.loadState();
  
  runner.assert(vmManager2.state.instances['i-test123'], 'State should be persisted');
  runner.assertEqual(
    vmManager2.state.instances['i-test123'].name, 
    'test-vm',
    'Instance name should be preserved'
  );
});

runner.test('VM instance creation works', async () => {
  const vmManager = new MockVMManager();
  
  const instance = await vmManager.createInstance('test-vm-create', {
    instanceType: 'm5.large',
    spot: true
  });
  
  runner.assert(instance.instanceId, 'Instance should have an ID');
  runner.assertEqual(instance.name, 'test-vm-create', 'Instance name should match');
  runner.assert(instance.config.spot, 'Spot option should be preserved');
  runner.assertEqual(instance.config.instanceType, 'm5.large', 'Instance type should match');
});

runner.test('VM instance listing works', async () => {
  const vmManager = new MockVMManager();
  
  // Create multiple test instances
  await vmManager.createInstance('vm-1');
  await vmManager.createInstance('vm-2');
  
  const instances = await vmManager.listInstances();
  
  runner.assert(instances.length >= 2, 'Should list multiple instances');
  runner.assert(instances.some(i => i.name === 'vm-1'), 'Should include vm-1');
  runner.assert(instances.some(i => i.name === 'vm-2'), 'Should include vm-2');
});

runner.test('VM instance ID resolution works', async () => {
  const vmManager = new MockVMManager();
  
  const instance = await vmManager.createInstance('test-resolve');
  const instanceId = instance.instanceId;
  
  // Test resolution by ID
  runner.assertEqual(
    vmManager.resolveInstanceId(instanceId),
    instanceId,
    'Should resolve instance ID to itself'
  );
  
  // Test resolution by name
  runner.assertEqual(
    vmManager.resolveInstanceId('test-resolve'),
    instanceId,
    'Should resolve instance name to ID'
  );
  
  // Test non-existent instance
  runner.assertEqual(
    vmManager.resolveInstanceId('non-existent'),
    null,
    'Should return null for non-existent instance'
  );
});

runner.test('SSH command generation works', async () => {
  const vmManager = new MockVMManager();
  
  const instance = await vmManager.createInstance('ssh-test');
  
  // Mock public IP
  vmManager.state.instances[instance.instanceId].publicIp = '54.123.45.67';
  
  const sshCommand = vmManager.getSSHCommand('ssh-test');
  
  runner.assert(sshCommand.includes('ssh'), 'Should contain ssh command');
  runner.assert(sshCommand.includes('54.123.45.67'), 'Should contain public IP');
  runner.assert(sshCommand.includes('ubuntu@'), 'Should use ubuntu user');
});

// MCP Tools Tests
runner.test('VMMCPTools initializes correctly', async () => {
  const mcpTools = new VMMCPTools({ stateFile: TEST_CONFIG.stateFile });
  
  runner.assert(mcpTools.vmManager instanceof VMManager, 'Should have VMManager instance');
  runner.assert(mcpTools.tools, 'Should have tools definitions');
  
  const toolDefs = mcpTools.getToolDefinitions();
  runner.assert(Array.isArray(toolDefs), 'Tool definitions should be array');
  runner.assert(toolDefs.length > 0, 'Should have tool definitions');
});

runner.test('MCP vm_create tool works', async () => {
  // Create custom mock for MCP tools
  class MockMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new MockMCPTools();
  
  const result = await mcpTools.vm_create({
    name: 'mcp-test-vm',
    instanceType: 'm5.large',
    spot: true
  });
  
  runner.assert(result.success, 'vm_create should succeed');
  runner.assert(result.instance, 'Should return instance info');
  runner.assertEqual(result.instance.name, 'mcp-test-vm', 'Should preserve instance name');
  runner.assert(result.sshCommand, 'Should include SSH command');
});

runner.test('MCP vm_list tool works', async () => {
  class MockMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new MockMCPTools();
  
  // Create test instances
  await mcpTools.vm_create({ name: 'list-test-1' });
  await mcpTools.vm_create({ name: 'list-test-2' });
  
  const result = await mcpTools.vm_list();
  
  runner.assert(result.success, 'vm_list should succeed');
  runner.assert(Array.isArray(result.instances), 'Should return instances array');
  runner.assert(result.instances.length >= 2, 'Should list created instances');
  runner.assert(result.summary, 'Should include summary');
});

runner.test('MCP vm_status tool works', async () => {
  class MockMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new MockMCPTools();
  
  const createResult = await mcpTools.vm_create({ name: 'status-test' });
  const result = await mcpTools.vm_status({ identifier: 'status-test' });
  
  runner.assert(result.success, 'vm_status should succeed');
  runner.assert(result.status, 'Should return status info');
  runner.assert(result.status.instanceId, 'Should include instance ID');
});

runner.test('MCP vm_terminate requires confirmation', async () => {
  class MockMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new MockMCPTools();
  
  await mcpTools.vm_create({ name: 'terminate-test' });
  
  // Test without confirmation
  const result1 = await mcpTools.vm_terminate({ 
    identifier: 'terminate-test',
    confirm: false 
  });
  
  runner.assert(!result1.success, 'Should fail without confirmation');
  runner.assert(result1.error.includes('Confirmation required'), 'Should require confirmation');
  
  // Test with confirmation
  const result2 = await mcpTools.vm_terminate({ 
    identifier: 'terminate-test',
    confirm: true 
  });
  
  runner.assert(result2.success, 'Should succeed with confirmation');
});

runner.test('MCP bulk creation works', async () => {
  class MockMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new MockMCPTools();
  
  const result = await mcpTools.vm_bulk_create({
    namePrefix: 'bulk-test',
    count: 3,
    instanceType: 'm5.large',
    spot: true
  });
  
  runner.assert(result.success, 'Bulk creation should succeed');
  runner.assertEqual(result.total, 3, 'Should create 3 instances');
  runner.assert(result.instances.length <= 3, 'Should not exceed requested count');
  runner.assert(result.created >= 0, 'Should track created count');
});

// Integration Tests (if not in mock mode)
if (!TEST_CONFIG.mockMode) {
  runner.test('Real AWS CLI availability check', async () => {
    const vmManager = new VMManager();
    
    try {
      // Try a simple AWS CLI command
      await vmManager.executeAWS(['sts', 'get-caller-identity']);
      console.log('   ✓ AWS CLI is available and configured');
    } catch (error) {
      throw new Error(`AWS CLI not available or not configured: ${error.message}`);
    }
  });
}

// Error handling tests
runner.test('VMManager handles invalid instance gracefully', async () => {
  const vmManager = new MockVMManager();
  
  try {
    await vmManager.getInstanceMetrics('non-existent-instance');
    // Should not throw, should return null
  } catch (error) {
    throw new Error('Should handle non-existent instance gracefully');
  }
});

runner.test('MCP tools handle errors gracefully', async () => {
  class ErrorMCPTools extends VMMCPTools {
    constructor() {
      super({ stateFile: TEST_CONFIG.stateFile });
      this.vmManager = new MockVMManager({ stateFile: TEST_CONFIG.stateFile });
    }
  }
  
  const mcpTools = new ErrorMCPTools();
  
  // Test error handling
  const result = await mcpTools.vm_status({ identifier: 'non-existent' });
  
  runner.assert(!result.success, 'Should return error for non-existent instance');
  runner.assert(result.error, 'Should include error message');
});

// Run all tests
runner.runAll().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});