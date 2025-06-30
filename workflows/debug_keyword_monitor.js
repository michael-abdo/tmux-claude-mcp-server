#!/usr/bin/env node
/**
 * Debug Keyword Monitor - Full logging visibility
 * Usage: node debug_keyword_monitor.js <instanceId> <keyword>
 */

const EventEmitter = require('events');
const MCPBridge = require('../src/workflow/mcp_bridge.cjs');

class DebugKeywordMonitor extends EventEmitter {
  constructor(options) {
    super();
    
    this.instanceId = options.instanceId;
    this.keyword = options.keyword;
    this.pollInterval = (options.pollInterval || 5) * 1000;
    this.timeout = (options.timeout || 300) * 1000;
    this.bridge = options.bridge || new MCPBridge();
    
    this.startTime = null;
    this.interval = null;
    this.lastReadPosition = 0;
    this.outputBuffer = '';
    this.pollCount = 0;
  }

  start() {
    console.log('🚀 STARTING DEBUG KEYWORD MONITOR');
    console.log(`📋 Instance ID: ${this.instanceId}`);
    console.log(`🔍 Keyword: "${this.keyword}"`);
    console.log(`⏱️  Poll Interval: ${this.pollInterval/1000}s`);
    console.log(`⏰ Timeout: ${this.timeout/1000}s`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    this.startTime = Date.now();
    
    // Start polling
    this.interval = setInterval(() => {
      this.checkOutput().catch(error => {
        console.error('💥 ERROR in checkOutput:', error);
        this.emit('error', error);
      });
    }, this.pollInterval);
    
    // Do an immediate check
    this.checkOutput().catch(console.error);
  }

  async checkOutput() {
    this.pollCount++;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    
    console.log(`\n📊 POLL #${this.pollCount} (${elapsed}s elapsed)`);
    
    try {
      // Check for timeout
      if (Date.now() - this.startTime > this.timeout) {
        console.log('⏰ TIMEOUT REACHED');
        this.stop();
        this.emit('timeout');
        return;
      }

      // Read output from instance
      console.log(`📥 Reading from instance ${this.instanceId}...`);
      const result = await this.bridge.read({
        instanceId: this.instanceId,
        lines: 200
      });

      if (!result.success) {
        console.error('❌ Failed to read instance output:', result.error);
        throw new Error(result.error || 'Failed to read instance output');
      }

      const newOutput = result.output || '';
      console.log(`📝 Raw output length: ${newOutput.length} characters`);
      
      if (newOutput.length > 0) {
        console.log('📄 New output snippet (last 200 chars):');
        console.log('─'.repeat(50));
        console.log(newOutput.slice(-200));
        console.log('─'.repeat(50));
      } else {
        console.log('📄 No new output detected');
      }
      
      // Update buffer
      const oldBufferLength = this.outputBuffer.length;
      this.outputBuffer = this.outputBuffer.slice(-1000) + newOutput;
      console.log(`💾 Buffer: ${oldBufferLength} → ${this.outputBuffer.length} chars`);
      
      // Check for keyword(s)
      const keywords = this.keyword.split('|').map(k => k.trim());
      console.log(`🔍 Searching for keywords: [${keywords.join(', ')}]`);
      
      for (const keyword of keywords) {
        console.log(`🔎 Checking for: "${keyword}"`);
        
        if (this.outputBuffer.includes(keyword)) {
          console.log('🎉 KEYWORD DETECTED!');
          console.log(`✅ Found: "${keyword}"`);
          
          // Show context
          const keywordIndex = this.outputBuffer.lastIndexOf(keyword);
          const contextStart = Math.max(0, keywordIndex - 100);
          const contextEnd = Math.min(this.outputBuffer.length, keywordIndex + keyword.length + 100);
          const context = this.outputBuffer.slice(contextStart, contextEnd);
          
          console.log('📍 Context around keyword:');
          console.log('═'.repeat(60));
          console.log(context);
          console.log('═'.repeat(60));
          
          this.stop();
          this.emit('keyword_detected', context, keyword);
          return;
        } else {
          console.log(`❌ Not found: "${keyword}"`);
        }
      }
      
      console.log('⏳ No keywords detected, continuing to monitor...');
      
    } catch (error) {
      console.error('💥 Error in checkOutput:', error);
      throw error;
    }
  }

  stop() {
    console.log('\n🛑 STOPPING KEYWORD MONITOR');
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// CLI usage
if (require.main === module) {
  const instanceId = process.argv[2];
  const keyword = process.argv[3];
  
  if (!instanceId || !keyword) {
    console.error('Usage: node debug_keyword_monitor.js <instanceId> <keyword>');
    console.error('Example: node debug_keyword_monitor.js spec_1_1_123456 "***STAGE1_COMPLETE***"');
    process.exit(1);
  }
  
  const monitor = new DebugKeywordMonitor({
    instanceId,
    keyword,
    pollInterval: 3, // 3 seconds for debugging
    timeout: 120     // 2 minutes
  });
  
  monitor.on('keyword_detected', (context, keyword) => {
    console.log('\n🎊 SUCCESS! Keyword detected and workflow can advance.');
    process.exit(0);
  });
  
  monitor.on('timeout', () => {
    console.log('\n⏰ TIMEOUT: No keyword detected within time limit');
    process.exit(1);
  });
  
  monitor.on('error', (error) => {
    console.error('\n💥 ERROR:', error);
    process.exit(1);
  });
  
  monitor.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down monitor...');
    monitor.stop();
    process.exit(0);
  });
}

module.exports = DebugKeywordMonitor;