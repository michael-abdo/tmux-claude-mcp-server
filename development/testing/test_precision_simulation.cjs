#!/usr/bin/env node

/**
 * Simulate the precision test by sending commands via MCP bridge
 */

const { spawn } = require('child_process');
const path = require('path');

async function testPrecisionWorkflow() {
  console.log('🧪 Precision Workflow Simulation Test\n');
  
  // Send a command that includes the keyword in the instruction
  console.log('📤 Sending command with EXECUTE_FINISHED in instruction...');
  
  const sendProcess = spawn('node', [
    path.join(__dirname, 'scripts', 'mcp_bridge.js'),
    'send',
    JSON.stringify({
      instanceId: 'spec_1_1_018229',
      text: 'Please run: date\n\nShow me the current date and time. When you are done, SAY EXECUTE_FINISHED'
    })
  ]);
  
  sendProcess.on('close', () => {
    console.log('✅ Command sent!');
    console.log('\n🔍 What to watch for:');
    console.log('- Monitor should NOT trigger on the instruction');
    console.log('- Monitor should ONLY trigger when Claude says EXECUTE_FINISHED');
    console.log('- Then auto-progression: Compare → Commit → Blank State');
    console.log('\n📊 Check the monitor output in the other terminal!');
  });
  
  sendProcess.on('error', (error) => {
    console.error('❌ Failed to send command:', error.message);
  });
}

testPrecisionWorkflow();