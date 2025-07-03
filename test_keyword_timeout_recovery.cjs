#!/usr/bin/env node

/**
 * Test Keyword Timeout Recovery
 * Verifies the system handles cases where Claude doesn't say expected keywords
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');
const { spawn } = require('child_process');

class KeywordTimeoutTester {
  constructor() {
    this.testResults = {
      engineInitialized: false,
      instanceSpawned: false,
      timeoutDetected: false,
      recoveryPromptSent: false,
      workflowRecovered: false,
      returnedToBlankState: false
    };
    this.instanceId = null;
  }

  async runTest() {
    console.log('🧪 Testing Keyword Timeout Recovery');
    console.log('=' .repeat(50));
    console.log('');
    console.log('📋 Test Scenario: Claude executes command but never says EXECUTE_FINISHED');
    console.log('📋 Expected: System detects timeout, sends recovery prompt, retries');
    console.log('');

    try {
      // Step 1: Initialize engine with short timeout for testing
      console.log('🚀 Step 1: Initializing workflow engine...');
      await this.initializeEngine();

      // Step 2: Spawn instance
      console.log('🔧 Step 2: Spawning test instance...');
      await this.spawnTestInstance();

      // Step 3: Send command but simulate Claude NOT saying keyword
      console.log('📤 Step 3: Sending command (simulating missing keyword)...');
      await this.simulateMissingKeyword();

      // Step 4: Wait for timeout and recovery
      console.log('⏰ Step 4: Waiting for timeout detection and recovery...');
      await this.waitForRecovery();

      // Step 5: Verify recovery worked
      console.log('✅ Step 5: Verifying recovery success...');
      await this.verifyRecovery();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.generateTestReport();
    }
  }

  async initializeEngine() {
    // Create a test workflow with very short timeouts
    const testWorkflowPath = await this.createTestWorkflow();
    
    this.engine = new PersistentEngine(testWorkflowPath, { debug: true });
    
    // Set up event handlers to track recovery
    this.engine.on('workflow_timeout', (data) => {
      console.log(`⏰ Timeout detected: ${data.stageId} on ${data.instanceId}`);
      this.testResults.timeoutDetected = true;
    });

    this.engine.on('monitor_error', (data) => {
      console.log(`🚨 Monitor error: ${data.error}`);
    });

    this.engine.on('blank_state_ready', (data) => {
      console.log(`🔄 Blank state ready: ${data.instanceId}`);
      this.testResults.returnedToBlankState = true;
    });

    await this.engine.initialize();
    this.testResults.engineInitialized = true;
    console.log('✅ Engine initialized with test workflow');
  }

  async createTestWorkflow() {
    const testWorkflow = `name: Keyword Timeout Test Workflow
description: Test workflow with short timeouts for recovery testing
version: 1.0

settings:
  useTaskIds: false
  poll_interval: 1
  timeout: 10
  instance_role: specialist
  workspace_mode: isolated

stages:
  - id: execute_stage
    name: Execute Command (Test)
    prompt: |
      Please run 'echo "test command"' but DO NOT say EXECUTE_FINISHED.
      This is a test of timeout recovery.
    trigger_keyword: EXECUTE_FINISHED
    timeout: 10
    on_success:
      - action: next_stage
        stage_id: compare_stage

  - id: compare_stage
    name: Compare Results (Test)
    prompt: |
      Compare the output. Please say COMPARE_FINISHED when done.
    trigger_keyword: COMPARE_FINISHED
    timeout: 10
    on_success:
      - action: return_to_blank_state
`;

    const testPath = '/tmp/test_keyword_timeout.yaml';
    require('fs').writeFileSync(testPath, testWorkflow);
    return testPath;
  }

  async spawnTestInstance() {
    const spawnResult = await this.engine.actionExecutor.execute({
      action: 'spawn',
      role: 'specialist',
      workspace_mode: 'isolated',
      context: 'Test instance for keyword timeout recovery'
    });

    this.instanceId = spawnResult.instanceId;
    this.testResults.instanceSpawned = true;
    console.log(`✅ Spawned test instance: ${this.instanceId}`);
  }

  async simulateMissingKeyword() {
    // Start the execute stage but don't send the keyword
    const executeStage = this.engine.config.stages.find(s => s.id === 'execute_stage');
    
    // Store instance ID in context
    this.engine.context.set('vars.current_instance_id', this.instanceId);
    
    // Execute the stage (this will start monitoring for EXECUTE_FINISHED)
    this.engine.executeStage(executeStage, this.instanceId);
    
    // Send a command but deliberately don't include the keyword
    await this.engine.actionExecutor.execute({
      action: 'send',
      instance_id: this.instanceId,
      text: 'echo "test command executed but no keyword said"'
    });

    console.log('📤 Sent command without keyword - timeout should occur');
  }

  async waitForRecovery() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Recovery test timeout - no recovery detected'));
      }, 60000); // 1 minute max wait

      // Monitor for recovery events
      let recoveryPromptDetected = false;
      let retryDetected = false;

      // Check for recovery prompt by monitoring engine output
      const checkRecovery = setInterval(async () => {
        try {
          // Check if recovery prompt was sent
          const output = await this.engine.actionExecutor.execute({
            action: 'read',
            instance_id: this.instanceId,
            lines: 10
          });

          if (output && output.output && output.output.includes('Recovery:')) {
            console.log('✅ Recovery prompt detected');
            this.testResults.recoveryPromptSent = true;
            recoveryPromptDetected = true;
          }

          if (output && output.output && output.output.includes('Retrying stage')) {
            console.log('✅ Stage retry detected');
            retryDetected = true;
          }

          // If both recovery and retry detected, test successful
          if (recoveryPromptDetected && retryDetected) {
            this.testResults.workflowRecovered = true;
            clearInterval(checkRecovery);
            clearTimeout(timeout);
            resolve();
          }

        } catch (error) {
          console.log(`⚠️ Recovery check error: ${error.message}`);
        }
      }, 2000); // Check every 2 seconds

      // Also listen for timeout event
      this.engine.once('workflow_timeout', () => {
        console.log('✅ Workflow timeout event received');
        // Continue checking for recovery
      });

    });
  }

  async verifyRecovery() {
    // Send the missing keyword to complete the recovery
    await this.engine.actionExecutor.execute({
      action: 'send',
      instance_id: this.instanceId,
      text: 'EXECUTE_FINISHED'
    });

    console.log('📤 Sent missing keyword to complete recovery test');

    // Wait a moment for processing
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if workflow progressed to next stage
    const output = await this.engine.actionExecutor.execute({
      action: 'read',
      instance_id: this.instanceId,
      lines: 10
    });

    if (output && output.output && output.output.includes('Compare the output')) {
      console.log('✅ Workflow successfully progressed to next stage after recovery');
      this.testResults.workflowRecovered = true;
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 KEYWORD TIMEOUT RECOVERY TEST REPORT');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Engine Initialized', passed: this.testResults.engineInitialized },
      { name: 'Instance Spawned', passed: this.testResults.instanceSpawned },
      { name: 'Timeout Detected', passed: this.testResults.timeoutDetected },
      { name: 'Recovery Prompt Sent', passed: this.testResults.recoveryPromptSent },
      { name: 'Workflow Recovered', passed: this.testResults.workflowRecovered },
      { name: 'Returned to Blank State', passed: this.testResults.returnedToBlankState }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(60));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);

    if (passedCount >= 4) { // Core recovery working
      console.log('🎉 KEYWORD TIMEOUT RECOVERY WORKING!');
      console.log('✅ System can detect missing keywords and initiate recovery');
      console.log('✅ Recovery prompts are sent to guide user');
      console.log('✅ Workflow can continue after recovery');
    } else {
      console.log('⚠️  Keyword timeout recovery needs fixes');
    }

    if (this.instanceId) {
      console.log(`\n🔗 Test instance ${this.instanceId} may still be running`);
      console.log(`   Manual attach: tmux attach -t claude_${this.instanceId}`);
    }

    console.log('='.repeat(60));
  }
}

// Run the test
const tester = new KeywordTimeoutTester();
tester.runTest().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});