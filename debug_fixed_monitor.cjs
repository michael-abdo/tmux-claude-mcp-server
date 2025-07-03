#!/usr/bin/env node

const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

console.log('🧪 Debug Fixed Keyword Monitor\n');

const monitor = new KeywordMonitor({
  instanceId: 'spec_1_1_625013',
  keyword: 'EXECUTE_FINISHED',
  pollInterval: 2,
  timeout: 10
});

// Override the readInstanceOutput method to debug
const originalRead = monitor.readInstanceOutput;
monitor.readInstanceOutput = async function() {
  try {
    const output = await originalRead.call(this);
    console.log('📄 Monitor read output length:', output.length);
    if (output.length > 0) {
      console.log('📄 Last 200 chars:', output.slice(-200));
      console.log('🔍 Contains EXECUTE_FINISHED:', output.includes('EXECUTE_FINISHED'));
    }
    return output;
  } catch (error) {
    console.error('❌ Read error:', error.message);
    return '';
  }
};

monitor.on('keyword_detected', (output) => {
  console.log('✅ EXECUTE_FINISHED detected!');
  monitor.stop();
  process.exit(0);
});

monitor.on('error', (error) => {
  console.error('❌ Monitor error:', error.message);
});

monitor.on('timeout', () => {
  console.log('⏰ Monitor timed out - keyword not detected');
  process.exit(1);
});

console.log('Starting debug monitor...');
monitor.start();