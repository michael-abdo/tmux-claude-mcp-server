/**
 * Keyword Monitor - Monitors Claude instance output for specific keywords
 * Supports both task ID mode and simple mode for keyword detection
 */

const EventEmitter = require('events');
const { spawn } = require('child_process');
const path = require('path');

class KeywordMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Validate required options
    if (!options.instanceId) {
      throw new Error('instanceId is required for keyword monitoring');
    }
    if (!options.keyword) {
      throw new Error('keyword is required for keyword monitoring');
    }
    
    this.instanceId = options.instanceId;
    this.keyword = options.keyword;
    this.pollInterval = (options.pollInterval || 5) * 1000; // Convert to milliseconds
    this.timeout = (options.timeout || 300) * 1000; // Convert to milliseconds
    this.simpleMode = options.simpleMode || false;
    
    this.isRunning = false;
    this.pollTimer = null;
    this.timeoutTimer = null;
    this.outputBuffer = '';
    this.lastReadTime = Date.now();
    
    // Path to MCP bridge script (portable resolution)
    this.mcpBridgePath = options.mcpBridgePath || 
      this.findMcpBridge();
  }
  
  start() {
    if (this.isRunning) {
      console.warn(`Monitor already running for instance ${this.instanceId}`);
      return;
    }
    
    console.log(`🔍 Starting keyword monitor for ${this.instanceId}, watching for: "${this.keyword}"`);
    this.isRunning = true;
    this.lastReadTime = Date.now();
    
    // Start polling
    this.pollTimer = setInterval(() => {
      this.checkForKeyword();
    }, this.pollInterval);
    
    // Set timeout
    this.timeoutTimer = setTimeout(() => {
      if (this.isRunning) {
        console.log(`⏰ Keyword monitor timeout for ${this.instanceId}`);
        this.stop();
        this.emit('timeout');
      }
    }, this.timeout);
    
    // Do initial check
    this.checkForKeyword();
  }
  
  stop() {
    if (!this.isRunning) {
      return;
    }
    
    console.log(`🛑 Stopping keyword monitor for ${this.instanceId}`);
    this.isRunning = false;
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
  
  async checkForKeyword() {
    if (!this.isRunning) {
      return;
    }
    
    try {
      // Read latest output from instance
      const output = await this.readInstanceOutput();
      
      if (output) {
        // Append to buffer and keep last 10000 characters
        this.outputBuffer += output;
        if (this.outputBuffer.length > 10000) {
          this.outputBuffer = this.outputBuffer.slice(-10000);
        }
        
        // Check for keyword
        let detected = false;
        if (this.simpleMode) {
          detected = this.detectSimpleKeyword(this.keyword);
        } else {
          detected = this.detectTaskIdKeyword(this.keyword);
        }
        
        if (detected) {
          console.log(`🎯 Keyword detected: "${this.keyword}" in instance ${this.instanceId}`);
          this.stop();
          this.emit('keyword_detected', this.outputBuffer);
        }
        
        this.lastReadTime = Date.now();
      }
      
    } catch (error) {
      console.error(`Error checking keyword for ${this.instanceId}:`, error.message);
      this.emit('error', error);
    }
  }
  
  detectSimpleKeyword(keyword) {
    try {
      const lowerKeyword = keyword.toLowerCase();
      const lowerBuffer = this.outputBuffer.toLowerCase();
      return lowerBuffer.includes(lowerKeyword);
    } catch (error) {
      console.error('Error in simple keyword detection:', error);
      return false;
    }
  }
  
  detectTaskIdKeyword(keyword) {
    try {
      // Task ID mode: Check for exact keyword match in recent output
      const lines = this.outputBuffer.split('\n');
      const recentLines = lines.slice(-20); // Check last 20 lines
      
      for (const line of recentLines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes(keyword)) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error in task ID keyword detection:', error);
      return false;
    }
  }
  
  findMcpBridge() {
    // Try multiple locations for the MCP bridge script
    const possiblePaths = [
      path.resolve(__dirname, '../scripts/mcp_bridge.js'),
      path.resolve(process.cwd(), 'scripts/mcp_bridge.js'),
      path.resolve(process.cwd(), 'src/scripts/mcp_bridge.js'),
      '/Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/mcp_bridge.js'
    ];
    
    for (const bridgePath of possiblePaths) {
      if (require('fs').existsSync(bridgePath)) {
        return bridgePath;
      }
    }
    
    // Fallback to relative path from workflow directory
    return path.resolve(__dirname, '../scripts/mcp_bridge.js');
  }

  async readInstanceOutput() {
    return new Promise((resolve, reject) => {
      const command = 'node';
      const args = [
        this.mcpBridgePath,
        'read',
        JSON.stringify({
          instanceId: this.instanceId,
          lines: 10
        })
      ];
      
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP bridge read failed: ${stderr}`));
          return;
        }
        
        try {
          // Parse the JSON response
          const lines = stdout.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const response = JSON.parse(lastLine);
          
          if (response.success && response.output) {
            resolve(response.output);
          } else {
            resolve(''); // No new output
          }
        } catch (error) {
          console.error('Failed to parse MCP bridge response:', error);
          resolve(''); // Don't fail on parse errors
        }
      });
      
      process.on('error', (error) => {
        reject(error);
      });
      
      // Set timeout for the read operation
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error('Read operation timeout'));
      }, 10000);
    });
  }
  
  getStatus() {
    return {
      instanceId: this.instanceId,
      keyword: this.keyword,
      isRunning: this.isRunning,
      bufferSize: this.outputBuffer.length,
      lastReadTime: this.lastReadTime,
      simpleMode: this.simpleMode
    };
  }
}

module.exports = KeywordMonitor;