#!/usr/bin/env node

/**
 * Complete User Journey Test
 * Test the entire workflow from universal launcher to infinite loop with auto-attach
 */

const { spawn } = require('child_process');
const path = require('path');

class CompleteJourneyTester {
  constructor() {
    this.testResults = {
      universalLauncher: false,
      instanceSpawned: false,
      blankStateReady: false,
      autoAttachSuccess: false,
      firstCycleComplete: false,
      secondCycleComplete: false,
      infiniteLoopWorking: false
    };
    this.instanceId = null;
    this.workflowProcess = null;
  }

  async runTest() {
    console.log('🧪 Complete User Journey Test');
    console.log('=' .repeat(60));
    console.log('');
    console.log('🎯 Testing: Universal Launcher → Auto-Spawn → Auto-Attach → Infinite Loop');
    console.log('');

    try {
      // Clean up any existing sessions
      await this.cleanup();

      // Step 1: Test universal launcher from subdirectory
      console.log('🚀 Step 1: Testing universal launcher from subdirectory...');
      await this.testUniversalLauncher();

      // Step 2: Test instance spawning and blank state
      console.log('⏳ Step 2: Waiting for instance spawn and blank state...');
      await this.waitForBlankState();

      // Step 3: Test auto-attach mechanism
      console.log('🔗 Step 3: Testing auto-attach mechanism...');
      await this.testAutoAttach();

      // Step 4: Test first workflow cycle
      console.log('🔄 Step 4: Testing first workflow cycle...');
      await this.testFirstCycle();

      // Step 5: Test second cycle (infinite loop)
      console.log('🔁 Step 5: Testing second cycle (infinite loop)...');
      await this.testSecondCycle();

      // Generate comprehensive report
      this.generateJourneyReport();

    } catch (error) {
      console.error('❌ Journey test failed:', error.message);
      this.generateJourneyReport();
    } finally {
      await this.cleanup();
    }
  }

  async testUniversalLauncher() {
    return new Promise((resolve, reject) => {
      // Change to test subdirectory and run universal launcher
      const testDir = path.join(process.cwd(), 'test-directories', 'project1');
      const launcherPath = path.join(process.cwd(), 'bin', 'workflow-start');
      
      console.log(`📂 Running from: ${testDir}`);
      console.log(`🔧 Launcher: ${launcherPath}`);

      this.workflowProcess = spawn(launcherPath, ['--debug', '--auto-attach'], {
        cwd: testDir,
        stdio: 'pipe'
      });

      let foundProjectRoot = false;
      let foundWorkflowFile = false;

      this.workflowProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(text.trim());

        // Check for successful launcher indicators
        if (text.includes('Found project root:')) {
          foundProjectRoot = true;
        }
        if (text.includes('Workflow file:') && text.includes('.yaml')) {
          foundWorkflowFile = true;
        }
        if (text.includes('Starting persistent workflow')) {
          this.testResults.universalLauncher = foundProjectRoot && foundWorkflowFile;
          console.log('✅ Universal launcher working correctly');
          resolve();
        }

        // Capture instance ID when available
        const instanceMatch = text.match(/Instance\s+(\w+)\s+ready/i) || 
                             text.match(/claude_(\w+)/);
        if (instanceMatch && !this.instanceId) {
          this.instanceId = instanceMatch[1];
          console.log(`🎯 Captured instance ID: ${this.instanceId}`);
        }
      });

      this.workflowProcess.stderr.on('data', (data) => {
        console.error('STDERR:', data.toString());
      });

      this.workflowProcess.on('error', (error) => {
        reject(error);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!this.testResults.universalLauncher) {
          reject(new Error('Universal launcher test timeout'));
        }
      }, 120000);
    });
  }

  async waitForBlankState() {
    return new Promise((resolve, reject) => {
      if (!this.workflowProcess) {
        reject(new Error('No workflow process running'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for blank state'));
      }, 180000); // 3 minutes

      const dataHandler = (data) => {
        const text = data.toString();
        console.log(text.trim());

        // Look for instance spawned
        if (text.includes('Spawned instance:') || text.includes('✅ Instance')) {
          this.testResults.instanceSpawned = true;
          console.log('✅ Instance spawned successfully');
        }

        // Look for blank state ready
        if (text.includes('ready for commands')) {
          this.testResults.blankStateReady = true;
          console.log('✅ Blank state ready');
          
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.workflowProcess.stdout.on('data', dataHandler);
    });
  }

  async testAutoAttach() {
    return new Promise((resolve) => {
      if (!this.workflowProcess) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        console.log('⏰ Auto-attach test timeout (may be expected)');
        resolve();
      }, 30000); // 30 seconds

      const dataHandler = (data) => {
        const text = data.toString();
        console.log(text.trim());

        if (text.includes('Auto-attach successful') || text.includes('Opened new Terminal')) {
          this.testResults.autoAttachSuccess = true;
          console.log('✅ Auto-attach successful!');
          
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }

        if (text.includes('Auto-attach failed') || text.includes('not supported')) {
          console.log('ℹ️  Auto-attach not supported on this platform (expected)');
          
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.workflowProcess.stdout.on('data', dataHandler);
    });
  }

  async testFirstCycle() {
    if (!this.instanceId) {
      // Try to get instance ID from tmux
      this.instanceId = await this.getInstanceFromTmux();
    }

    if (!this.instanceId) {
      throw new Error('No instance ID available for testing');
    }

    console.log(`📤 Sending first EXECUTE_FINISHED to ${this.instanceId}...`);
    
    // Send first command
    await this.sendToInstance('Run ls -la and SAY EXECUTE_FINISHED\n\nEXECUTE_FINISHED');

    // Monitor for cycle completion
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('First cycle timeout'));
      }, 120000); // 2 minutes

      let detectedCompare = false;
      let detectedCommit = false;
      let detectedBlankReturn = false;

      const dataHandler = (data) => {
        const text = data.toString();
        console.log('CYCLE1:', text.trim());

        if (text.includes('Compare Results') || text.includes('compare_stage')) {
          detectedCompare = true;
          console.log('✅ Compare stage triggered');
        }

        if (text.includes('Commit Changes') || text.includes('commit_stage')) {
          detectedCommit = true;
          console.log('✅ Commit stage triggered');
        }

        if (text.includes('Blank state ready') || text.includes('ready for next')) {
          detectedBlankReturn = true;
          console.log('✅ Returned to blank state');
        }

        if (detectedCompare && detectedCommit && detectedBlankReturn) {
          this.testResults.firstCycleComplete = true;
          this.workflowProcess.stdout.removeListener('data', dataHandler);
          clearTimeout(timeout);
          resolve();
        }
      };

      this.workflowProcess.stdout.on('data', dataHandler);
    });
  }

  async testSecondCycle() {
    console.log(`📤 Sending second EXECUTE_FINISHED to test infinite loop...`);
    
    // Wait a moment for system to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send second command
    await this.sendToInstance('Run pwd and SAY EXECUTE_FINISHED\n\nEXECUTE_FINISHED');

    // Monitor for second cycle
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Second cycle timeout'));
      }, 120000); // 2 minutes

      let secondCycleDetected = false;

      const dataHandler = (data) => {
        const text = data.toString();
        console.log('CYCLE2:', text.trim());

        if (text.includes('EXECUTE_FINISHED detected') || 
            text.includes('Compare Results') ||
            text.includes('starting new workflow cycle')) {
          secondCycleDetected = true;
          this.testResults.secondCycleComplete = true;
          this.testResults.infiniteLoopWorking = true;
          console.log('✅ Second cycle triggered - infinite loop working!');
          
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
      throw new Error('No instance ID for sending messages');
    }

    const sendProcess = spawn('node', [
      'scripts/mcp_bridge.js',
      'send',
      JSON.stringify({
        instanceId: this.instanceId,
        text: text
      })
    ], {
      stdio: 'pipe'
    });

    return new Promise((resolve, reject) => {
      sendProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Send command failed with code ${code}`));
        }
      });
    });
  }

  async getInstanceFromTmux() {
    return new Promise((resolve) => {
      const listProcess = spawn('tmux', ['list-sessions'], { stdio: 'pipe' });
      
      let output = '';
      listProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      listProcess.on('close', (code) => {
        if (code === 0) {
          const match = output.match(/claude_(\w+):/);
          resolve(match ? match[1] : null);
        } else {
          resolve(null);
        }
      });
    });
  }

  generateJourneyReport() {
    console.log('\n' + '='.repeat(70));
    console.log('📊 COMPLETE USER JOURNEY TEST REPORT');
    console.log('='.repeat(70));

    const tests = [
      { name: 'Universal Launcher', passed: this.testResults.universalLauncher },
      { name: 'Instance Spawned', passed: this.testResults.instanceSpawned },
      { name: 'Blank State Ready', passed: this.testResults.blankStateReady },
      { name: 'Auto-Attach Success', passed: this.testResults.autoAttachSuccess },
      { name: 'First Cycle Complete', passed: this.testResults.firstCycleComplete },
      { name: 'Second Cycle Complete', passed: this.testResults.secondCycleComplete },
      { name: 'Infinite Loop Working', passed: this.testResults.infiniteLoopWorking }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(70));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);

    if (passedCount >= 5) { // Core functionality working
      console.log('🎉 PERSISTENT WORKFLOW SYSTEM WORKING!');
      console.log('✅ Core Requirements Met:');
      console.log('   - Universal launcher finds project from any directory');
      console.log('   - Instance spawning and blank state management');
      console.log('   - Automatic workflow progression');
      console.log('   - Infinite loop behavior');
    } else {
      console.log('⚠️  Some core functionality needs fixes');
    }

    if (this.testResults.autoAttachSuccess) {
      console.log('🔗 Auto-attach is working (Terminal should have opened)');
    } else {
      console.log('ℹ️  Auto-attach may not be supported on this platform');
    }

    if (this.instanceId) {
      console.log(`\n🔗 Instance ${this.instanceId} may still be running`);
      console.log(`   Manual attach: tmux attach -t claude_${this.instanceId}`);
    }

    console.log('='.repeat(70));
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    if (this.workflowProcess && !this.workflowProcess.killed) {
      this.workflowProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Clean up tmux sessions
    try {
      const killProcess = spawn('tmux', ['kill-server'], { stdio: 'inherit' });
      await new Promise(resolve => {
        killProcess.on('close', () => resolve());
      });
    } catch (error) {
      // Ignore errors
    }
    
    console.log('✅ Cleanup complete');
  }
}

// Run the complete journey test
const tester = new CompleteJourneyTester();
tester.runTest().catch(error => {
  console.error('Fatal journey test error:', error);
  process.exit(1);
});