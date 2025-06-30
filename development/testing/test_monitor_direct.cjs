#!/usr/bin/env node

const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

console.log('🧪 Testing Keyword Monitor on spec_1_1_625013\n');

const monitor = new KeywordMonitor({
  instanceId: 'spec_1_1_625013',
  keyword: 'EXECUTE_FINISHED',
  pollInterval: 2,
  timeout: 30
});

monitor.on('keyword_detected', (output) => {
  console.log('✅ EXECUTE_FINISHED detected!');
  console.log('📄 Output snippet:', output.slice(-100));
  console.log('\n🎯 This proves the monitor works!');
  monitor.stop();
  process.exit(0);
});

monitor.on('error', (error) => {
  console.error('❌ Monitor error:', error.message);
});

monitor.on('timeout', () => {
  console.log('⏰ Monitor timed out');
  process.exit(1);
});

console.log('Starting monitor...');
monitor.start();