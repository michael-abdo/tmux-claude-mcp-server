#!/usr/bin/env node

/**
 * Test Persistent Automation - Verify MONITOR sends stage prompts automatically
 * This test ensures that the workflow monitor handles all transitions autonomously
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class PersistentWorkflowTester {
  constructor() {
    this.workflowProcess = null;
    this.testTimeout = 300000; // 5 minutes
    this.instanceId = null;
    this.testResults = {
      spawnSuccess: false,
      blankStateReady: false,
      executeFinishedDetected: false,
      compareStageTriggered: false,
      commitStageTriggered: false,
      returnToBlankState: false,
      secondCycleWorks: false
    };
  }

  async runTest() {
    console.log('🧪 Testing Persistent Workflow Automation');
    console.log('=' .repeat(50));
    console.log('');
    console.log('🎯 CRITICAL TEST: Verify MONITOR sends stage prompts automatically');
    console.log('📋 Expected Flow:');
    console.log('   1. Start persistent workflow → spawn instance → blank state');
    console.log('   2. Send "EXECUTE_FINISHED" → auto-trigger compare stage');
    console.log('   3. Compare completes → auto-trigger commit stage');
    console.log('   4. Commit completes → return to blank state');
    console.log('   5. Send second "EXECUTE_FINISHED" → verify cycle repeats');
    console.log('');

    try {
      // Clean up any existing instances
      await this.cleanup();

      // Step 1: Start persistent workflow
      console.log('🚀 Step 1: Starting persistent workflow...');
      await this.startPersistentWorkflow();

      // Step 2: Wait for blank state ready
      console.log('⏳ Step 2: Waiting for blank state ready...');
      await this.waitForBlankState();

      // Step 3: Send EXECUTE_FINISHED and verify automatic progression
      console.log('🎯 Step 3: Testing automatic workflow progression...');
      await this.testAutomaticProgression();

      // Step 4: Test second cycle
      console.log('🔄 Step 4: Testing second cycle...');
      await this.testSecondCycle();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('💥 Test failed:', error.message);
      this.generateTestReport();
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async startPersistentWorkflow() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for persistent workflow to start'));
      }, 60000);

      this.workflowProcess = spawn('node', [
        'src/workflow/run_persistent_workflow.cjs',
        '--debug'
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      this.workflowProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        console.log(text.trim());

        // Check for spawn success
        if (text.includes('Persistent workflow started on instance')) {
          const match = text.match(/instance\s+(\w+)/);
          if (match) {
            this.instanceId = match[1];
            this.testResults.spawnSuccess = true;
            console.log(`✅ Instance spawned: ${this.instanceId}`);
          }
        }

        // Check for blank state ready
        if (text.includes('ready for commands')) {
          this.testResults.blankStateReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.workflowProcess.stderr.on('data', (data) => {
        console.error('STDERR:', data.toString());
      });

      this.workflowProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async waitForBlankState() {
    if (!this.testResults.blankStateReady) {
      throw new Error('Blank state not ready - cannot proceed with test');
    }
    console.log('✅ Blank state confirmed ready');
  }

  async testAutomaticProgression() {
    console.log('📤 Sending EXECUTE_FINISHED to trigger workflow...');
    
    // Send EXECUTE_FINISHED to the instance
    const sendResult = await this.sendToInstance('Run ls -la and SAY EXECUTE_FINISHED\n\nEXECUTE_FINISHED');
    if (!sendResult) {
      throw new Error('Failed to send EXECUTE_FINISHED to instance');
    }

    console.log('👂 Monitoring for automatic stage progression...');
    
    // Monitor the workflow process output for automatic stage transitions
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for automatic progression'));
      }, 120000); // 2 minutes

      let detectedCompare = false;
      let detectedCommit = false;
      let detectedBlankReturn = false;

      const dataHandler = (data) => {
        const text = data.toString();
        console.log('MONITOR:', text.trim());

        // Check for EXECUTE_FINISHED detection
        if (text.includes('EXECUTE_FINISHED detected')) {
          this.testResults.executeFinishedDetected = true;
          console.log('✅ EXECUTE_FINISHED detected by monitor');
        }

        // Check for compare stage trigger
        if (text.includes('Compare Results') || text.includes('Executing stage: compare')) {
          this.testResults.compareStageTriggered = true;
          detectedCompare = true;
          console.log('✅ Compare stage automatically triggered');
        }

        // Check for commit stage trigger
        if (text.includes('Commit Changes') || text.includes('Executing stage: commit')) {
          this.testResults.commitStageTriggered = true;
          detectedCommit = true;
          console.log('✅ Commit stage automatically triggered');
        }

        // Check for return to blank state
        if (text.includes('Returning to blank state') || text.includes('ready for next EXECUTE_FINISHED')) {
          this.testResults.returnToBlankState = true;
          detectedBlankReturn = true;
          console.log('✅ Returned to blank state automatically');
        }

        // If we've seen all stages, complete the test
        if (detectedCompare && detectedCommit && detectedBlankReturn) {
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.workflowProcess.stdout.on('data', dataHandler);
    });
  }

  async testSecondCycle() {
    console.log('📤 Sending second EXECUTE_FINISHED to verify infinite loop...');
    
    // Wait a moment for the system to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const sendResult = await this.sendToInstance('Run pwd and SAY EXECUTE_FINISHED\n\nEXECUTE_FINISHED');
    if (!sendResult) {
      throw new Error('Failed to send second EXECUTE_FINISHED');
    }

    // Monitor for second cycle
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for second cycle'));
      }, 60000);

      let secondCycleDetected = false;

      const dataHandler = (data) => {
        const text = data.toString();
        console.log('SECOND CYCLE:', text.trim());

        if (text.includes('EXECUTE_FINISHED detected') || 
            text.includes('Proceeding to compare stage')) {
          this.testResults.secondCycleWorks = true;
          secondCycleDetected = true;
          console.log('✅ Second cycle triggered successfully');
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.workflowProcess.stdout.on('data', dataHandler);
    });
  }

  async sendToInstance(text) {
    if (!this.instanceId) {
      console.error('❌ No instance ID available');
      return false;
    }

    try {
      const { spawn } = require('child_process');
      const sendProcess = spawn('node', [
        'scripts/mcp_bridge.js',
        'send',
        JSON.stringify({
          instanceId: this.instanceId,
          text: text
        })
      ]);

      return new Promise((resolve) => {
        sendProcess.on('close', (code) => {
          resolve(code === 0);
        });
      });
    } catch (error) {
      console.error('❌ Failed to send to instance:', error);
      return false;
    }
  }

  generateTestReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERSISTENT WORKFLOW AUTOMATION TEST REPORT');
    console.log('='.repeat(60));
    
    const tests = [
      { name: 'Instance Spawn Success', passed: this.testResults.spawnSuccess },
      { name: 'Blank State Ready', passed: this.testResults.blankStateReady },
      { name: 'EXECUTE_FINISHED Detection', passed: this.testResults.executeFinishedDetected },
      { name: 'Compare Stage Auto-Triggered', passed: this.testResults.compareStageTriggered },
      { name: 'Commit Stage Auto-Triggered', passed: this.testResults.commitStageTriggered },
      { name: 'Return to Blank State', passed: this.testResults.returnToBlankState },
      { name: 'Second Cycle Works', passed: this.testResults.secondCycleWorks }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(60));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('🎉 ALL TESTS PASSED - Persistent workflow automation working correctly!');
      console.log('✅ CRITICAL VERIFICATION: MONITOR sends stage prompts automatically');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Automation needs fixes');
      console.log('❌ CRITICAL ISSUE: Manual intervention still required');
    }

    if (this.instanceId) {
      console.log(`\n🔗 Instance ${this.instanceId} may still be running`);
      console.log(`   Attach with: tmux attach -t claude_${this.instanceId}`);
    }

    console.log('='.repeat(60));
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    if (this.workflowProcess && !this.workflowProcess.killed) {
      this.workflowProcess.kill('SIGTERM');
      // Wait for process to exit
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Clean up tmux sessions
    try {
      const { spawn } = require('child_process');
      const killProcess = spawn('tmux', ['kill-server'], { stdio: 'inherit' });
      await new Promise(resolve => {
        killProcess.on('close', () => resolve());
      });
    } catch (error) {
      // Ignore errors - tmux might not be running
    }
    
    console.log('✅ Cleanup complete');
  }
}

// Run the test
const tester = new PersistentWorkflowTester();
tester.runTest().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});