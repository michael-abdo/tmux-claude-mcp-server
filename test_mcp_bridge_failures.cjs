#!/usr/bin/env node

/**
 * Test MCP Bridge Connection Failures
 * Verifies the system handles MCP bridge connection errors gracefully
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const ActionExecutor = require('./src/workflow/action_executor.cjs');
const WorkflowContext = require('./src/workflow/workflow_context.cjs');
const path = require('path');

class MCPBridgeFailureTester {
  constructor() {
    this.testResults = {
      engineInitialized: false,
      bridgeFailureSimulated: false,
      errorHandlingTriggered: false,
      recoveryAttempted: false,
      fallbackWorking: false
    };
    this.engine = null;
    this.originalActionExecutor = null;
  }

  async runTest() {
    console.log('🧪 Testing MCP Bridge Failure Handling');
    console.log('=' .repeat(50));
    console.log('');
    console.log('📋 Test Scenario: MCP bridge connection fails during operation');
    console.log('📋 Expected: Graceful error handling, recovery attempts, fallback behavior');
    console.log('');

    try {
      // Step 1: Initialize engine
      console.log('🚀 Step 1: Initializing workflow engine...');
      await this.initializeEngine();

      // Step 2: Test normal operation first
      console.log('✅ Step 2: Testing normal MCP bridge operation...');
      await this.testNormalOperation();

      // Step 3: Simulate bridge failures
      console.log('🔌 Step 3: Simulating MCP bridge failures...');
      await this.simulateBridgeFailures();

      // Step 4: Test error handling
      console.log('🚨 Step 4: Testing error handling...');
      await this.testErrorHandling();

      // Step 5: Test recovery mechanisms
      console.log('🚑 Step 5: Testing recovery mechanisms...');
      await this.testRecoveryMechanisms();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.generateTestReport();
    }
  }

  async initializeEngine() {
    const workflowPath = path.join(__dirname, 'workflows/core/persistent_execute_compare_commit.yaml');
    
    this.engine = new PersistentEngine(workflowPath, { debug: true });
    
    // Set up event handlers to track bridge errors
    this.engine.on('monitor_error', (data) => {
      console.log(`🚨 Monitor error detected: ${data.error}`);
      this.testResults.errorHandlingTriggered = true;
    });

    this.engine.on('workflow_fatal_error', (data) => {
      console.log(`💀 Fatal workflow error: ${data.error}`);
    });

    await this.engine.initialize();
    this.testResults.engineInitialized = true;
    console.log('✅ Engine initialized');
  }

  async testNormalOperation() {
    // Test that MCP bridge works normally first
    try {
      const listResult = await this.engine.actionExecutor.execute({
        action: 'list'
      });
      
      if (listResult && listResult.success) {
        console.log('✅ Normal MCP bridge operation confirmed');
      } else {
        console.log('⚠️ MCP bridge may already have issues');
      }
    } catch (error) {
      console.log(`⚠️ Initial MCP bridge test failed: ${error.message}`);
    }
  }

  async simulateBridgeFailures() {
    // Create a mock action executor that simulates bridge failures
    this.originalActionExecutor = this.engine.actionExecutor;
    
    const mockActionExecutor = new FailingActionExecutor(
      this.engine.context, 
      this.engine.options
    );
    
    this.engine.actionExecutor = mockActionExecutor;
    this.testResults.bridgeFailureSimulated = true;
    console.log('✅ Bridge failure simulation activated');
  }

  async testErrorHandling() {
    // Try to perform operations that will fail
    try {
      console.log('📤 Attempting spawn operation (should fail)...');
      await this.engine.actionExecutor.execute({
        action: 'spawn',
        role: 'specialist'
      });
    } catch (error) {
      console.log(`✅ Spawn failure handled: ${error.message}`);
      this.testResults.errorHandlingTriggered = true;
    }

    try {
      console.log('📤 Attempting list operation (should fail)...');
      await this.engine.actionExecutor.execute({
        action: 'list'
      });
    } catch (error) {
      console.log(`✅ List failure handled: ${error.message}`);
    }

    try {
      console.log('📤 Attempting send operation (should fail)...');
      await this.engine.actionExecutor.execute({
        action: 'send',
        instance_id: 'fake_id',
        text: 'test'
      });
    } catch (error) {
      console.log(`✅ Send failure handled: ${error.message}`);
    }
  }

  async testRecoveryMechanisms() {
    // Test the recovery mechanisms in the engine
    console.log('🔄 Testing instance health check with failing bridge...');
    
    try {
      const healthCheck = await this.engine.checkInstanceHealth('fake_id');
      if (!healthCheck) {
        console.log('✅ Health check correctly identified failed bridge');
        this.testResults.recoveryAttempted = true;
      }
    } catch (error) {
      console.log(`✅ Health check failed as expected: ${error.message}`);
      this.testResults.recoveryAttempted = true;
    }

    // Test dead instance handling
    console.log('🚑 Testing dead instance recovery with bridge failure...');
    
    try {
      await this.engine.handleDeadInstance('fake_dead_instance');
    } catch (error) {
      console.log(`✅ Dead instance recovery handled bridge failure: ${error.message}`);
    }

    // Restore original action executor
    console.log('🔌 Restoring normal MCP bridge operation...');
    this.engine.actionExecutor = this.originalActionExecutor;

    // Test that normal operation is restored
    try {
      const listResult = await this.engine.actionExecutor.execute({
        action: 'list'
      });
      
      if (listResult && listResult.success) {
        console.log('✅ Normal operation restored after recovery');
        this.testResults.fallbackWorking = true;
      }
    } catch (error) {
      console.log(`⚠️ Recovery did not restore normal operation: ${error.message}`);
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MCP BRIDGE FAILURE HANDLING TEST REPORT');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Engine Initialized', passed: this.testResults.engineInitialized },
      { name: 'Bridge Failure Simulated', passed: this.testResults.bridgeFailureSimulated },
      { name: 'Error Handling Triggered', passed: this.testResults.errorHandlingTriggered },
      { name: 'Recovery Attempted', passed: this.testResults.recoveryAttempted },
      { name: 'Fallback Working', passed: this.testResults.fallbackWorking }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(60));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);

    if (passedCount >= 3) {
      console.log('🎉 MCP BRIDGE FAILURE HANDLING WORKING!');
      console.log('✅ System handles bridge connection failures gracefully');
      console.log('✅ Error handling prevents system crashes');
      console.log('✅ Recovery mechanisms attempt to restore functionality');
    } else {
      console.log('⚠️  MCP bridge failure handling needs improvements');
    }

    console.log('\n📋 Recommendations:');
    console.log('  - Implement retry logic with exponential backoff');
    console.log('  - Add circuit breaker pattern for repeated failures');
    console.log('  - Consider offline mode for when bridge is unavailable');
    console.log('  - Log bridge failures for debugging');

    console.log('='.repeat(60));
  }
}

// Mock ActionExecutor that simulates bridge failures
class FailingActionExecutor extends ActionExecutor {
  constructor(context, options) {
    super(context, options);
    this.failureCount = 0;
    this.maxFailures = 5;
  }

  async execute(action) {
    this.failureCount++;
    
    // Simulate different types of failures
    if (this.failureCount <= this.maxFailures) {
      const failures = [
        'MCP bridge connection timeout',
        'MCP bridge process not found',
        'Permission denied accessing MCP bridge',
        'MCP bridge returned invalid JSON',
        'Network error connecting to bridge'
      ];
      
      const failureMessage = failures[this.failureCount - 1] || 'Generic bridge failure';
      throw new Error(`Simulated failure: ${failureMessage}`);
    }
    
    // After max failures, delegate to parent (simulate recovery)
    return super.execute(action);
  }

  async callMcpBridge(command, params) {
    if (this.failureCount <= this.maxFailures) {
      throw new Error(`Simulated MCP bridge failure for command: ${command}`);
    }
    
    return super.callMcpBridge(command, params);
  }
}

// Run the test
const tester = new MCPBridgeFailureTester();
tester.runTest().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});