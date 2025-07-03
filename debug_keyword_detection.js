#!/usr/bin/env node

/**
 * Debug keyword detection to see what the monitor actually reads
 */

import KeywordMonitor from './src/workflow/keyword_monitor.cjs';

async function debugKeywordDetection() {
  console.log('🔍 Debugging keyword detection...');
  
  const instanceId = 'spec_1_1_141314';
  const keyword = 'EXECUTE_FINISHED';
  
  const monitor = new KeywordMonitor({
    instanceId: instanceId,
    keyword: keyword,
    pollInterval: 1, // 1 second
    timeout: 10,     // 10 seconds
    simpleMode: true,
    debug: true // Enable debug logging
  });
  
  // Override the checkForKeyword method to see what it reads
  const originalCheck = monitor.checkForKeyword.bind(monitor);
  monitor.checkForKeyword = async function() {
    try {
      const output = await this.readInstanceOutput();
      console.log(`\n📖 Raw output (${output.length} chars):`);
      console.log('─'.repeat(80));
      console.log(output.slice(-500)); // Show last 500 chars
      console.log('─'.repeat(80));
      
      // Check if keyword exists in output
      const hasKeyword = output.includes(keyword);
      console.log(`🔍 Contains "${keyword}": ${hasKeyword}`);
      
      if (hasKeyword) {
        console.log('✅ KEYWORD FOUND IN RAW OUTPUT!');
        
        // Test simple detection
        const simpleDetected = this.detectSimpleKeyword(keyword);
        console.log(`🎯 Simple detection result: ${simpleDetected}`);
        
        // Test task ID detection  
        const taskDetected = this.detectTaskIdKeyword(keyword);
        console.log(`🎯 Task ID detection result: ${taskDetected}`);
      }
      
      return originalCheck.call(this);
    } catch (error) {
      console.error('Debug error:', error);
      return originalCheck.call(this);
    }
  };
  
  monitor.on('keyword_detected', (data) => {
    console.log('✅ KEYWORD DETECTED!');
    process.exit(0);
  });
  
  monitor.on('timeout', () => {
    console.log('⏰ Monitor timeout');
    process.exit(1);
  });
  
  monitor.on('error', (error) => {
    console.error('❌ Monitor error:', error.message);
    process.exit(1);
  });
  
  console.log('🚀 Starting debug monitor...');
  monitor.start();
}

debugKeywordDetection().catch(console.error);