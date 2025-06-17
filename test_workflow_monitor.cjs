#!/usr/bin/env node

/**
 * Test the workflow monitor directly on an existing instance
 */

const path = require('path');
const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

async function test() {
  console.log('🧪 Testing Workflow Monitor\n');
  
  // Use the existing instance
  const instanceId = 'spec_1_1_524664';
  
  console.log(`📋 Setting up monitor for instance: ${instanceId}`);
  console.log('🔍 Monitoring for EXECUTE_FINISHED keyword...\n');
  
  const monitor = new KeywordMonitor({
    instanceId: instanceId,
    keyword: 'EXECUTE_FINISHED',
    pollInterval: 2,
    timeout: 0, // No timeout
    simpleMode: true
  });
  
  monitor.on('keyword_detected', async (output) => {
    console.log('✅ EXECUTE_FINISHED detected!');
    console.log('📄 Output:', output.slice(-200));
    console.log('\n🎯 In a real workflow, this would trigger:');
    console.log('   1. Send compare stage prompt');
    console.log('   2. Monitor for COMPARE_FINISHED');
    console.log('   3. Send commit stage prompt');
    console.log('   4. Monitor for COMMIT_FINISHED');
    console.log('   5. Return to blank state\n');
    
    monitor.stop();
    process.exit(0);
  });
  
  monitor.on('error', (error) => {
    console.error('❌ Monitor error:', error);
  });
  
  console.log('Starting monitor... (send a command ending with EXECUTE_FINISHED in the tmux session)\n');
  monitor.start();
}

test().catch(console.error);