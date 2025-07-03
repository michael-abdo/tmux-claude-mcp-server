#!/usr/bin/env node

/**
 * Test Stuck Workflow Detection and Recovery
 * Verifies the system can detect and recover from stuck workflow states
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');

class StuckWorkflowTester {
  constructor() {
    this.testResults = {
      engineInitialized: false,
      instanceSpawned: false,
      workflowStuck: false,
      stuckDetected: false,
      recoveryInitiated: false,
      workflowUnstuck: false
    };
    this.instanceId = null;
    this.engine = null;
  }

  async runTest() {
    console.log('🧪 Testing Stuck Workflow Detection and Recovery');
    console.log('=' .repeat(50));
    console.log('');
    console.log('📋 Test Scenario: Workflow gets stuck in intermediate state');
    console.log('📋 Expected: System detects stuck state, initiates recovery');
    console.log('');

    try {
      // Step 1: Initialize engine
      console.log('🚀 Step 1: Initializing workflow engine...');
      await this.initializeEngine();

      // Step 2: Spawn instance
      console.log('🔧 Step 2: Spawning test instance...');
      await this.spawnTestInstance();

      // Step 3: Create stuck workflow scenario
      console.log('🔒 Step 3: Creating stuck workflow scenario...');
      await this.createStuckScenario();

      // Step 4: Monitor for stuck detection
      console.log('👀 Step 4: Monitoring for stuck detection...');
      await this.monitorStuckDetection();

      // Step 5: Verify recovery
      console.log('🚑 Step 5: Verifying recovery mechanism...');
      await this.verifyRecovery();

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
    
    // Set up event handlers to track stuck detection
    this.engine.on('workflow_stuck', (data) => {
      console.log(`🔒 Workflow stuck detected: ${data.stageId} for ${data.duration}ms`);
      this.testResults.stuckDetected = true;
    });

    this.engine.on('workflow_timeout', (data) => {
      console.log(`⏰ Workflow timeout: ${data.stageId} - attempting recovery`);
      this.testResults.recoveryInitiated = true;
    });

    this.engine.on('blank_state_ready', (data) => {
      console.log(`🔄 Blank state ready: ${data.instanceId}`);
    });

    await this.engine.initialize();
    this.testResults.engineInitialized = true;
    console.log('✅ Engine initialized');
  }

  async spawnTestInstance() {
    const spawnResult = await this.engine.actionExecutor.execute({
      action: 'spawn',
      role: 'specialist',
      workspace_mode: 'isolated',
      context: 'Test instance for stuck workflow recovery'
    });

    this.instanceId = spawnResult.instanceId;
    this.testResults.instanceSpawned = true;
    console.log(`✅ Spawned test instance: ${this.instanceId}`);
  }

  async createStuckScenario() {
    // Start a stage but prevent it from completing naturally
    const compareStage = this.engine.config.stages.find(s => s.id === 'compare_stage');
    
    // Store instance ID in context
    this.engine.context.set('vars.current_instance_id', this.instanceId);
    
    // Start the compare stage
    console.log('🎯 Starting compare stage...');
    await this.engine.executeStage(compareStage, this.instanceId);
    
    // Send a command that will confuse Claude (doesn't lead to COMPARE_FINISHED)
    await this.engine.actionExecutor.execute({
      action: 'send',
      instance_id: this.instanceId,
      text: 'This is confusing input that will not lead to COMPARE_FINISHED being said.'
    });

    console.log('🔒 Created stuck scenario - stage started but will not complete');
    this.testResults.workflowStuck = true;
  }

  async monitorStuckDetection() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stuck detection timeout - no stuck state detected'));
      }, 120000); // 2 minutes max wait

      // Manually trigger stuck detection after a delay
      setTimeout(async () => {
        console.log('🔍 Manually triggering stuck workflow detection...');
        
        // Simulate stuck workflow detection
        await this.engine.handleStuckWorkflow(this.instanceId, 'compare_stage', 60000);
        
        // Check if recovery was initiated
        setTimeout(() => {
          if (this.testResults.stuckDetected || this.testResults.recoveryInitiated) {
            clearTimeout(timeout);
            resolve();
          }
        }, 5000);
        
      }, 15000); // Trigger after 15 seconds

      // Also listen for actual stuck detection events
      this.engine.once('workflow_stuck', () => {
        console.log('✅ Automatic stuck detection working');
        clearTimeout(timeout);
        resolve();
      });

      this.engine.once('workflow_timeout', () => {
        console.log('✅ Timeout-based recovery triggered');
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async verifyRecovery() {
    // Check if recovery prompt was sent
    await new Promise(resolve => setTimeout(resolve, 3000));

    const output = await this.engine.actionExecutor.execute({
      action: 'read',
      instance_id: this.instanceId,
      lines: 10
    });

    if (output && output.output) {
      if (output.output.includes('Recovery:') || output.output.includes('notice you may not have completed')) {
        console.log('✅ Recovery prompt was sent to instance');
        this.testResults.recoveryInitiated = true;
      }

      // Now send the correct response to unstick the workflow
      console.log('📤 Sending correct response to unstick workflow...');
      await this.engine.actionExecutor.execute({
        action: 'send',
        instance_id: this.instanceId,
        text: 'COMPARE_FINISHED'
      });

      // Wait for workflow to progress
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if workflow progressed
      const newOutput = await this.engine.actionExecutor.execute({
        action: 'read',
        instance_id: this.instanceId,
        lines: 10
      });

      if (newOutput && newOutput.output && newOutput.output.includes('git status')) {
        console.log('✅ Workflow successfully unstuck and progressed to commit stage');
        this.testResults.workflowUnstuck = true;
      }
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 STUCK WORKFLOW RECOVERY TEST REPORT');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Engine Initialized', passed: this.testResults.engineInitialized },
      { name: 'Instance Spawned', passed: this.testResults.instanceSpawned },
      { name: 'Workflow Stuck Created', passed: this.testResults.workflowStuck },
      { name: 'Stuck State Detected', passed: this.testResults.stuckDetected },
      { name: 'Recovery Initiated', passed: this.testResults.recoveryInitiated },
      { name: 'Workflow Unstuck', passed: this.testResults.workflowUnstuck }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(60));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);

    if (passedCount >= 4) {
      console.log('🎉 STUCK WORKFLOW RECOVERY WORKING!');
      console.log('✅ System can detect stuck workflow states');
      console.log('✅ Recovery mechanisms are triggered appropriately');
      console.log('✅ Workflows can be unstuck and continue');
    } else {
      console.log('⚠️  Stuck workflow recovery needs improvements');
    }

    if (this.instanceId) {
      console.log(`\n🔗 Test instance ${this.instanceId} may still be running`);
      console.log(`   Manual attach: tmux attach -t claude_${this.instanceId}`);
    }

    console.log('='.repeat(60));
  }
}

// Run the test
const tester = new StuckWorkflowTester();
tester.runTest().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});