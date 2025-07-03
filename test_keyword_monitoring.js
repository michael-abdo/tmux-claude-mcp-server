#!/usr/bin/env node

/**
 * Test keyword monitoring functionality
 */

import KeywordMonitor from './src/workflow/keyword_monitor.cjs';

async function testKeywordMonitoring() {
  console.log('🧪 Testing keyword monitoring...');
  
  // Use the authenticated instance
  const instanceId = 'spec_1_1_141314';
  const keyword = 'EXECUTE_FINISHED';
  
  console.log(`📍 Testing with instance: ${instanceId}`);
  console.log(`🔍 Looking for keyword: ${keyword}`);
  
  const monitor = new KeywordMonitor({
    instanceId: instanceId,
    keyword: keyword,
    pollInterval: 2, // 2 seconds
    timeout: 30,     // 30 seconds
    simpleMode: true
  });
  
  // Set up event handlers
  monitor.on('keyword_detected', (data) => {
    console.log('✅ KEYWORD DETECTED!', data);
    process.exit(0);
  });
  
  monitor.on('timeout', () => {
    console.log('⏰ Monitor timeout - no keyword detected');
    process.exit(1);
  });
  
  monitor.on('error', (error) => {
    console.error('❌ Monitor error:', error.message);
    process.exit(1);
  });
  
  // Start monitoring
  monitor.start();
  
  console.log('🚀 Monitor started - waiting for keyword detection...');
}

testKeywordMonitoring().catch(console.error);