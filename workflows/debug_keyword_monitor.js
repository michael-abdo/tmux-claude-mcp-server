#!/usr/bin/env node
/**
 * Debug Keyword Monitor - Full logging visibility
 * Usage: node debug_keyword_monitor.js <instanceId> <keyword>
 */

import { EventEmitter } from 'events';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
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
        
        // Split buffer into lines to check each line's context
        const lines = this.outputBuffer.split('\n');
        let foundValidKeyword = false;
        
        // Track if we're inside a multi-line user command
        let inUserCommand = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          // Detect start of user command
          if (trimmedLine.startsWith('>')) {
            inUserCommand = true;
            console.log(`🟡 Starting user command block at line ${i}: "${trimmedLine.substring(0, 50)}..."`);
          }
          
          // Detect end of user command (Claude output starts)
          if (inUserCommand && (
            trimmedLine.includes('⏺') ||  // Claude output marker
            (trimmedLine.length > 0 && 
             !trimmedLine.startsWith('>') && 
             !trimmedLine.startsWith('│') &&
             !trimmedLine.startsWith('╭') &&
             !trimmedLine.startsWith('╰') &&
             !trimmedLine.startsWith('┌') &&
             !trimmedLine.startsWith('└') &&
             !trimmedLine.startsWith('├') &&
             !trimmedLine.startsWith('─') &&
             !trimmedLine.startsWith(' ') &&  // Not indented continuation
             !trimmedLine.match(/^[a-zA-Z]+:/) &&  // Not a field like "type:"
             trimmedLine.length > 10)  // Substantial content
          )) {
            inUserCommand = false;
            console.log(`🟢 Ending user command block at line ${i}: "${trimmedLine.substring(0, 50)}..."`);
          }
          
          if (line.includes(keyword)) {
            // Check if this line is part of user input
            const isUserInput = inUserCommand || 
                               trimmedLine.startsWith('>') || 
                               line.includes('plz say') || 
                               line.includes('please say') ||
                               line.includes('type:');
            
            if (isUserInput) {
              console.log(`🚫 Ignoring keyword in user input (multi-line=${inUserCommand}): "${trimmedLine.substring(0, 100)}..."`);
              continue;
            }
            
            // Check if this is a completion signal vs just mentioning the keyword
            const isCompletionSignal = this.isActualCompletionSignal(line, keyword);
            
            if (!isCompletionSignal) {
              console.log(`🔸 Keyword found but not as completion signal: "${trimmedLine.substring(0, 100)}..."`);
              continue;
            }
            
            // This is Claude output with actual completion signal
            foundValidKeyword = true;
            console.log('🎉 COMPLETION KEYWORD DETECTED IN CLAUDE OUTPUT!');
            console.log(`✅ Found completion signal: "${keyword}" in line: "${trimmedLine}"`);
            
            // Show context
            const keywordIndex = this.outputBuffer.lastIndexOf(keyword);
            const contextStart = Math.max(0, keywordIndex - 200);
            const contextEnd = Math.min(this.outputBuffer.length, keywordIndex + keyword.length + 200);
            const context = this.outputBuffer.slice(contextStart, contextEnd);
            
            console.log('📍 Context around keyword:');
            console.log('═'.repeat(60));
            console.log(context);
            console.log('═'.repeat(60));
            
            this.stop();
            this.emit('keyword_detected', context, keyword);
            return;
          }
        }
        
        if (!foundValidKeyword) {
          console.log(`❌ Not found in Claude output: "${keyword}"`);
        }
      }
      
      console.log('⏳ No keywords detected, continuing to monitor...');
      
    } catch (error) {
      console.error('💥 Error in checkOutput:', error);
      throw error;
    }
  }

  /**
   * Check if keyword appears as actual completion signal vs just mentioned in content
   */
  isActualCompletionSignal(line, keyword) {
    const trimmedLine = line.trim();
    
    // Ignore if keyword appears in todo lists or planning content
    if (trimmedLine.includes('☐') ||  // Todo checkbox
        trimmedLine.includes('□') ||  // Alt todo checkbox
        trimmedLine.includes('⎿') ||  // Todo branch
        trimmedLine.includes('Document') ||
        trimmedLine.includes('signal completion') ||
        trimmedLine.includes('with ' + keyword) ||
        trimmedLine.includes('and ' + keyword) ||
        trimmedLine.includes('using ' + keyword) ||
        trimmedLine.includes('say ' + keyword) ||
        trimmedLine.includes('type ' + keyword)) {
      return false;
    }
    
    // Look for actual completion signals - keyword appears prominently
    // Either standalone or with completion markers
    return (
      trimmedLine === keyword ||  // Standalone keyword
      trimmedLine.startsWith(keyword) ||  // Starts with keyword
      trimmedLine.includes('⏺ ' + keyword) ||  // With Claude marker
      trimmedLine.includes('✅ ' + keyword) ||  // With checkmark
      trimmedLine.includes('🎉 ' + keyword) ||  // With celebration
      (trimmedLine.includes(keyword) && trimmedLine.length < 50)  // Short line with keyword
    );
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
if (import.meta.url === `file://${process.argv[1]}`) {
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

export default DebugKeywordMonitor;