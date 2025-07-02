#!/usr/bin/env node

/**
 * Test Auto-Attach Functionality
 * Verify the auto-attach mechanism works with persistent workflow
 */

const { spawn } = require('child_process');
const AutoAttach = require('./src/workflow/auto_attach.cjs');

class AutoAttachTester {
  constructor() {
    this.testResults = {
      workflowSpawn: false,
      sessionExists: false,
      autoAttachSuccess: false,
      terminalOpened: false
    };
  }

  async runTest() {
    console.log('🧪 Testing Auto-Attach Functionality');
    console.log('='.repeat(50));
    console.log('');

    try {
      // Step 1: Start persistent workflow (no auto-attach yet)
      console.log('🚀 Step 1: Starting persistent workflow without auto-attach...');
      const instanceId = await this.startWorkflowAndGetInstance();
      
      if (!instanceId) {
        throw new Error('Failed to get instance ID from workflow');
      }

      console.log(`✅ Got instance ID: ${instanceId}`);
      this.testResults.workflowSpawn = true;

      // Step 2: Wait for session to be ready
      console.log('⏳ Step 2: Waiting for tmux session to be ready...');
      await this.waitForSession(instanceId);
      this.testResults.sessionExists = true;

      // Step 3: Test auto-attach mechanism
      console.log('🔗 Step 3: Testing auto-attach mechanism...');
      const autoAttach = new AutoAttach({ debug: true });
      
      const attachSuccess = await autoAttach.attachToSession(instanceId);
      this.testResults.autoAttachSuccess = attachSuccess;
      
      if (attachSuccess) {
        console.log('✅ Auto-attach reported success!');
        this.testResults.terminalOpened = true;
      } else {
        console.log('⚠️  Auto-attach reported failure (this may be expected on non-macOS)');
      }

      // Step 4: Verify session is still active
      console.log('🔍 Step 4: Verifying session is still active...');
      const sessionActive = await autoAttach.verifySessionExists(`claude_${instanceId}`);
      
      if (sessionActive) {
        console.log('✅ Session still active after auto-attach attempt');
      } else {
        console.log('❌ Session not found after auto-attach attempt');
      }

      // Generate test report
      this.generateTestReport(instanceId);

    } catch (error) {
      console.error('❌ Test failed:', error.message);
      this.generateTestReport();
    }
  }

  async startWorkflowAndGetInstance() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for workflow to start'));
      }, 60000); // 1 minute timeout

      const workflowProcess = spawn('node', [
        'src/workflow/run_persistent_workflow.cjs',
        '--debug'
      ], {
        stdio: 'pipe'
      });

      let instanceId = null;

      workflowProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log(text.trim());

        // Look for instance ID in the output
        const instanceMatch = text.match(/Instance\s+(\w+)\s+ready/i) || 
                             text.match(/claude_(\w+)/);
        
        if (instanceMatch && !instanceId) {
          instanceId = instanceMatch[1];
          console.log(`🎯 Captured instance ID: ${instanceId}`);
          
          // Give it a moment to fully initialize
          setTimeout(() => {
            workflowProcess.kill('SIGTERM');
            clearTimeout(timeout);
            resolve(instanceId);
          }, 3000);
        }

        // Also look for "ready for commands" message
        if (text.includes('ready for commands') && !instanceId) {
          // Try to extract from earlier output or use a fallback method
          setTimeout(() => {
            workflowProcess.kill('SIGTERM');
            clearTimeout(timeout);
            // If we still don't have instance ID, try to get it from tmux
            this.getInstanceFromTmux().then(resolve).catch(reject);
          }, 2000);
        }
      });

      workflowProcess.stderr.on('data', (data) => {
        console.error('STDERR:', data.toString());
      });

      workflowProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async getInstanceFromTmux() {
    return new Promise((resolve, reject) => {
      const listProcess = spawn('tmux', ['list-sessions'], { stdio: 'pipe' });
      
      let output = '';
      listProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      listProcess.on('close', (code) => {
        if (code === 0) {
          // Look for claude_ sessions
          const match = output.match(/claude_(\w+):/);
          if (match) {
            resolve(match[1]);
          } else {
            reject(new Error('No Claude sessions found'));
          }
        } else {
          reject(new Error('Failed to list tmux sessions'));
        }
      });
    });
  }

  async waitForSession(instanceId) {
    const sessionName = `claude_${instanceId}`;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const exists = await this.checkSessionExists(sessionName);
      if (exists) {
        console.log(`✅ Session ${sessionName} is ready`);
        return true;
      }
      
      attempts++;
      console.log(`⏳ Waiting for session... (${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error(`Session ${sessionName} never became ready`);
  }

  async checkSessionExists(sessionName) {
    return new Promise((resolve) => {
      const process = spawn('tmux', ['has-session', '-t', sessionName], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  generateTestReport(instanceId = null) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTO-ATTACH TEST REPORT');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Workflow Spawn Success', passed: this.testResults.workflowSpawn },
      { name: 'tmux Session Created', passed: this.testResults.sessionExists },
      { name: 'Auto-Attach Mechanism', passed: this.testResults.autoAttachSuccess },
      { name: 'Terminal Opened', passed: this.testResults.terminalOpened }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('\n' + '-'.repeat(60));
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} tests passed`);

    if (this.testResults.autoAttachSuccess) {
      console.log('🎉 AUTO-ATTACH WORKING! Terminal should have opened automatically');
    } else {
      console.log('ℹ️  Auto-attach may not work on this platform (expected on non-macOS)');
    }

    if (instanceId) {
      console.log(`\n🔗 Instance ${instanceId} may still be running`);
      console.log(`   Manual attach: tmux attach -t claude_${instanceId}`);
    }

    console.log('='.repeat(60));
  }
}

// Run the test
const tester = new AutoAttachTester();
tester.runTest().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});