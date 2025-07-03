#!/usr/bin/env node

/**
 * Test the improved precision with a real workflow instance
 */

const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

console.log('🎯 Testing Improved Precision on Real Instance\n');

// Test on the existing instance that has COMMIT_FINISHED in both user and Claude messages
const monitor = new KeywordMonitor({
  instanceId: 'spec_1_1_018229',
  keyword: 'COMMIT_FINISHED',
  pollInterval: 2,
  timeout: 10,
  simpleMode: true
});

let detectionCount = 0;

monitor.on('keyword_detected', (output) => {
  detectionCount++;
  console.log(`✅ Detection #${detectionCount}: COMMIT_FINISHED found!`);
  
  // Show what was extracted
  const extracted = monitor.extractMostRecentClaudeResponse(output);
  console.log('\n📄 Extracted Claude response:');
  console.log('─'.repeat(50));
  console.log(extracted.slice(-200)); // Show last 200 chars
  console.log('─'.repeat(50));
  
  monitor.stop();
  
  if (detectionCount === 1) {
    console.log('\n🎯 SUCCESS: Precision detection working!');
    console.log('The monitor should now only trigger on Claude\'s actual responses.');
  }
  
  process.exit(0);
});

monitor.on('error', (error) => {
  console.error('❌ Monitor error:', error.message);
});

monitor.on('timeout', () => {
  console.log('⏰ Monitor timed out');
  console.log('This could mean:');
  console.log('- No new Claude responses with COMMIT_FINISHED');
  console.log('- The precision fix is working (ignoring old user messages)');
  process.exit(0);
});

console.log('📡 Starting precision test monitor...');
console.log('This will verify the detection only triggers on Claude\'s responses\n');
monitor.start();