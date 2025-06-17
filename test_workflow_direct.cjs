#!/usr/bin/env node

/**
 * Direct test of persistent workflow functionality
 */

const { spawn } = require('child_process');
const path = require('path');

// Test the workflow directly
async function test() {
  console.log('🧪 Direct Persistent Workflow Test\n');
  
  // Start the workflow runner
  const workflowProcess = spawn('node', [
    path.join(__dirname, 'src/workflow/run_persistent_workflow.cjs'),
    '--debug'
  ]);
  
  let instanceId = null;
  let output = '';
  
  workflowProcess.stdout.on('data', (data) => {
    const text = data.toString();
    output += text;
    console.log('[Workflow]', text.trim());
    
    // Extract instance ID
    const match = text.match(/Instance (\w+) ready/);
    if (match) {
      instanceId = match[1];
      console.log(`\n✅ Detected instance: ${instanceId}\n`);
    }
  });
  
  workflowProcess.stderr.on('data', (data) => {
    console.error('[Error]', data.toString().trim());
  });
  
  // Wait for startup
  console.log('⏳ Waiting for workflow to start...\n');
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  if (!instanceId) {
    console.log('❌ No instance detected in output');
    console.log('Output received:', output);
    workflowProcess.kill();
    process.exit(1);
  }
  
  // Send a test command
  console.log('\n📤 Sending test command...\n');
  const sendProcess = spawn('node', [
    path.join(__dirname, 'scripts/mcp_bridge.js'),
    'send',
    JSON.stringify({
      instanceId: instanceId,
      text: 'Please run: echo "Hello World"\n\nWhen done, SAY EXECUTE_FINISHED'
    })
  ]);
  
  sendProcess.on('close', () => {
    console.log('✅ Command sent\n');
  });
  
  // Monitor for 20 seconds
  console.log('📊 Monitoring workflow progression...\n');
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  // Check the output
  if (output.includes('EXECUTE_FINISHED detected')) {
    console.log('✅ EXECUTE_FINISHED detected');
  }
  if (output.includes('analyze and compare')) {
    console.log('✅ Compare stage triggered');
  }
  if (output.includes('git status')) {
    console.log('✅ Commit stage triggered');
  }
  if (output.includes('Ready for next')) {
    console.log('✅ Returned to blank state');
  }
  
  // Cleanup
  console.log('\n🧹 Cleaning up...');
  workflowProcess.kill();
  
  // Terminate instance
  const terminateProcess = spawn('node', [
    path.join(__dirname, 'scripts/mcp_bridge.js'),
    'terminate',
    JSON.stringify({ instanceId: instanceId })
  ]);
  
  terminateProcess.on('close', () => {
    console.log('✅ Test complete\n');
  });
}

test().catch(console.error);