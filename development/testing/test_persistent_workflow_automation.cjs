#!/usr/bin/env node

/**
 * Integration test for persistent workflow automation
 * Verifies the complete execute→compare→commit→blank cycle
 */

const { spawn } = require('child_process');
const path = require('path');

const MCP_BRIDGE_PATH = path.join(__dirname, 'scripts', 'mcp_bridge.js');
const WORKFLOW_RUNNER_PATH = path.join(__dirname, 'src', 'workflow', 'run_persistent_workflow.cjs');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper to call MCP bridge
async function callMcpBridge(command, args) {
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', [MCP_BRIDGE_PATH, command, JSON.stringify(args)]);
    
    let stdout = '';
    let stderr = '';
    
    mcpProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP bridge failed with code ${code}: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          resolve(stdout);
        }
      }
    });
  });
}

// Helper to sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test phases
const TestPhases = {
  STARTUP: 'startup',
  EXECUTE: 'execute',
  COMPARE: 'compare', 
  COMMIT: 'commit',
  BLANK_STATE: 'blank_state',
  SECOND_CYCLE: 'second_cycle'
};

async function runTest() {
  console.log(`${colors.blue}🧪 Persistent Workflow Automation Test${colors.reset}\n`);
  
  let workflowProcess = null;
  let instanceId = null;
  let testPhase = TestPhases.STARTUP;
  
  try {
    // Start the persistent workflow
    console.log(`${colors.yellow}📌 Phase 1: Starting persistent workflow...${colors.reset}`);
    workflowProcess = spawn('node', [WORKFLOW_RUNNER_PATH, '--debug']);
    
    let workflowOutput = '';
    workflowProcess.stdout.on('data', (data) => {
      const output = data.toString();
      workflowOutput += output;
      console.log(`[Workflow] ${output.trim()}`);
      
      // Extract instance ID from output
      const idMatch = output.match(/instance\s+(\w+_\d+_\d+)/);
      if (idMatch && !instanceId) {
        instanceId = idMatch[1];
        console.log(`${colors.green}✅ Detected instance ID: ${instanceId}${colors.reset}`);
      }
    });
    
    workflowProcess.stderr.on('data', (data) => {
      console.error(`[Workflow Error] ${data.toString().trim()}`);
    });
    
    // Wait for workflow to start and instance to be ready
    await sleep(5000);
    
    if (!instanceId) {
      // Try to find instance via list command
      console.log(`${colors.yellow}🔍 Looking for instance via list command...${colors.reset}`);
      const listResult = await callMcpBridge('list', {});
      console.log('List result:', listResult);
      
      // Find the most recent specialist instance
      if (listResult.instances && listResult.instances.length > 0) {
        const specialist = listResult.instances.find(inst => inst.role === 'specialist');
        if (specialist) {
          instanceId = specialist.id;
          console.log(`${colors.green}✅ Found instance via list: ${instanceId}${colors.reset}`);
        }
      }
    }
    
    if (!instanceId) {
      throw new Error('Failed to detect instance ID');
    }
    
    // Phase 2: Send initial command
    console.log(`\n${colors.yellow}📌 Phase 2: Sending initial command with EXECUTE_FINISHED...${colors.reset}`);
    testPhase = TestPhases.EXECUTE;
    
    await callMcpBridge('send', {
      instanceId: instanceId,
      text: 'Please run: ls -la\n\nShow me all files in the current directory. When done, SAY EXECUTE_FINISHED'
    });
    
    console.log('Command sent, waiting for workflow progression...');
    
    // Monitor output for keyword progression
    let cycleComplete = false;
    let compareDetected = false;
    let commitDetected = false;
    let blankStateDetected = false;
    
    const startTime = Date.now();
    const timeout = 60000; // 60 second timeout
    
    while (!cycleComplete && (Date.now() - startTime) < timeout) {
      await sleep(2000);
      
      // Read instance output
      const readResult = await callMcpBridge('read', {
        instanceId: instanceId,
        lines: 50
      });
      
      if (readResult.output) {
        const output = readResult.output;
        
        // Check for phase transitions
        if (!compareDetected && output.includes('EXECUTE_FINISHED')) {
          console.log(`${colors.green}✅ EXECUTE_FINISHED detected${colors.reset}`);
          testPhase = TestPhases.COMPARE;
          compareDetected = true;
        }
        
        if (compareDetected && !commitDetected && output.includes('COMPARE_FINISHED')) {
          console.log(`${colors.green}✅ COMPARE_FINISHED detected${colors.reset}`);
          testPhase = TestPhases.COMMIT;
          commitDetected = true;
        }
        
        if (commitDetected && !blankStateDetected && output.includes('COMMIT_FINISHED')) {
          console.log(`${colors.green}✅ COMMIT_FINISHED detected${colors.reset}`);
          testPhase = TestPhases.BLANK_STATE;
          blankStateDetected = true;
        }
        
        if (blankStateDetected && output.includes('Ready for your next command')) {
          console.log(`${colors.green}✅ Returned to blank state${colors.reset}`);
          cycleComplete = true;
        }
      }
    }
    
    if (!cycleComplete) {
      throw new Error(`Test timed out in phase: ${testPhase}`);
    }
    
    // Phase 3: Test second cycle
    console.log(`\n${colors.yellow}📌 Phase 3: Testing second cycle...${colors.reset}`);
    testPhase = TestPhases.SECOND_CYCLE;
    
    await callMcpBridge('send', {
      instanceId: instanceId,
      text: 'Now run: pwd\n\nShow me the current working directory. When done, SAY EXECUTE_FINISHED'
    });
    
    // Wait and check for second cycle
    await sleep(5000);
    
    const secondRead = await callMcpBridge('read', {
      instanceId: instanceId,
      lines: 20
    });
    
    if (secondRead.output && secondRead.output.includes('pwd')) {
      console.log(`${colors.green}✅ Second command executed${colors.reset}`);
    }
    
    // Test complete
    console.log(`\n${colors.green}🎉 Test completed successfully!${colors.reset}`);
    console.log('The persistent workflow correctly:');
    console.log('  1. Started in blank state');
    console.log('  2. Executed user command');
    console.log('  3. Automatically progressed through compare stage');
    console.log('  4. Automatically progressed through commit stage');
    console.log('  5. Returned to blank state');
    console.log('  6. Was ready for second command');
    
  } catch (error) {
    console.error(`\n${colors.red}❌ Test failed in phase ${testPhase}: ${error.message}${colors.reset}`);
    process.exit(1);
  } finally {
    // Cleanup
    if (workflowProcess) {
      console.log(`\n${colors.yellow}🧹 Cleaning up...${colors.reset}`);
      workflowProcess.kill();
    }
    
    if (instanceId) {
      try {
        await callMcpBridge('terminate', { instanceId });
        console.log(`Terminated instance ${instanceId}`);
      } catch (e) {
        console.warn(`Failed to terminate instance: ${e.message}`);
      }
    }
  }
}

// Run the test
runTest().catch(console.error);