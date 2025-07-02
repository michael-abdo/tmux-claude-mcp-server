/**
 * Keyword Monitor - Monitors Claude instance output for specific keywords
 */

const EventEmitter = require('events');
const MCPBridge = require('./mcp_bridge.cjs');

class KeywordMonitor extends EventEmitter {
  constructor(options) {
    super();
    
    this.instanceId = options.instanceId;
    this.keyword = options.keyword;
    this.pollInterval = (options.pollInterval || 5) * 1000; // Convert to ms
    this.timeout = (options.timeout || 300) * 1000; // Convert to ms
    this.bridge = options.bridge || new MCPBridge();
    
    this.startTime = null;
    this.interval = null;
    this.lastReadPosition = 0;
    this.outputBuffer = '';
  }

  start() {
    console.log(`Starting keyword monitor for instance ${this.instanceId}`);
    console.log(`Looking for keyword: ${this.keyword}`);
    
    this.startTime = Date.now();
    
    // Start polling
    this.interval = setInterval(() => {
      this.checkOutput().catch(error => {
        console.error('Error checking output:', error);
        this.emit('error', error);
      });
    }, this.pollInterval);
    
    // Do an immediate check
    this.checkOutput().catch(console.error);
  }

  async checkOutput() {
    try {
      // Check for timeout
      if (Date.now() - this.startTime > this.timeout) {
        this.stop();
        this.emit('timeout');
        return;
      }

      // Read output from instance
      const result = await this.bridge.read({
        instanceId: this.instanceId,
        lines: 200 // Read last 200 lines
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to read instance output');
      }

      const newOutput = result.output || '';
      
      // Append to buffer (in case keyword spans multiple reads)
      this.outputBuffer = this.outputBuffer.slice(-1000) + newOutput; // Keep last 1000 chars
      
      // Check for keyword(s)
      const keywords = this.keyword.split('|').map(k => k.trim());
      
      for (const keyword of keywords) {
        if (this.outputBuffer.includes(keyword)) {
          console.log(`Keyword detected: ${keyword}`);
          this.stop();
          
          // Extract context around the keyword
          const keywordIndex = this.outputBuffer.lastIndexOf(keyword);
          const contextStart = Math.max(0, keywordIndex - 500);
          const contextEnd = Math.min(this.outputBuffer.length, keywordIndex + keyword.length + 500);
          const context = this.outputBuffer.slice(contextStart, contextEnd);
          
          this.emit('keyword_detected', context, keyword);
          return;
        }
      }
      
      // Check if instance is still alive
      const instances = await this.bridge.list({});
      if (instances.success) {
        const instance = instances.instances.find(i => i.id === this.instanceId);
        if (!instance) {
          console.warn(`Instance ${this.instanceId} no longer exists`);
          this.stop();
          this.emit('instance_terminated');
          return;
        }
      }
      
    } catch (error) {
      // Don't stop on errors, just emit them
      this.emit('error', error);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log(`Stopped keyword monitor for instance ${this.instanceId}`);
  }

  // Helper method to check if monitoring is active
  isActive() {
    return this.interval !== null;
  }

  // Get elapsed time
  getElapsedTime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }
}

module.exports = KeywordMonitor;