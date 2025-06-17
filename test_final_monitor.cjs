#!/usr/bin/env node

/**
 * Final test - send a new EXECUTE_FINISHED and see if monitor detects it
 */

const { spawn } = require('child_process');
const path = require('path');
const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

async function test() {
  console.log('🧪 Final Monitor Test\n');
  console.log('This will:');
  console.log('1. Start monitoring spec_1_1_625013');
  console.log('2. Send a new command with EXECUTE_FINISHED');
  console.log('3. Verify detection works\n');
  
  // Start monitor
  const monitor = new KeywordMonitor({
    instanceId: 'spec_1_1_625013',
    keyword: 'EXECUTE_FINISHED',
    pollInterval: 2,
    timeout: 20,
    simpleMode: true
  });
  
  let detectionWorked = false;
  
  monitor.on('keyword_detected', (output) => {
    console.log('✅ SUCCESS! EXECUTE_FINISHED detected by monitor!');
    console.log('🎯 The persistent workflow system IS working!');
    detectionWorked = true;
    monitor.stop();
    process.exit(0);
  });
  
  monitor.on('error', (error) => {
    console.error('❌ Monitor error:', error.message);
  });
  
  monitor.on('timeout', () => {
    console.log('⏰ Monitor timed out');
    if (!detectionWorked) {
      console.log('❌ Detection failed - there may be an issue with new output detection');
    }
    process.exit(1);
  });
  
  console.log('📡 Starting monitor...');
  monitor.start();
  
  // Wait 3 seconds then send a fresh command
  setTimeout(async () => {
    console.log('📤 Sending fresh command to trigger detection...');
    
    const sendProcess = spawn('node', [
      path.join(__dirname, 'scripts', 'mcp_bridge.js'),
      'send',
      JSON.stringify({
        instanceId: 'spec_1_1_625013',
        text: 'Run: date\\n\\nShow current date and time. When done, SAY EXECUTE_FINISHED'
      })
    ]);
    
    sendProcess.on('close', () => {
      console.log('✅ Fresh command sent - monitor should detect it...');
    });
    
  }, 3000);
}

test().catch(console.error);