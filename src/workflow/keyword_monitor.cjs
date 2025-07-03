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
        
        // Debug: Show what we're checking
        if (process.env.DEBUG || this.debug) {
          console.log(`📖 Read ${output.length} chars from ${this.instanceId}`);
          console.log(`🔍 Checking for keyword: "${this.keyword}"`);
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
      // Extract only Claude's most recent response to avoid false positives
      const claudeResponse = this.extractMostRecentClaudeResponse(this.outputBuffer);
      
      if (!claudeResponse) {
        return false; // No Claude response found
      }
      
      const lowerKeyword = keyword.toLowerCase();
      const lowerResponse = claudeResponse.toLowerCase();
      return lowerResponse.includes(lowerKeyword);
    } catch (error) {
      console.error('Error in simple keyword detection:', error);
      return false;
    }
  }
  
  extractMostRecentClaudeResponse(output) {
    try {
      const lines = output.split('\n');
      
      // Find the last user message (starts with ">")
      let lastUserMessageIndex = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].trim().startsWith('>')) {
          lastUserMessageIndex = i;
          break;
        }
      }
      
      if (lastUserMessageIndex === -1) {
        // No user message found, return empty to avoid false positives
        return '';
      }
      
      // Find Claude response markers after the last user message
      // Look for ● (Claude Code format) or ⏺ (standard format)
      let firstClaudeResponseIndex = -1;
      for (let i = lastUserMessageIndex + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('●') || trimmed.startsWith('⏺')) {
          firstClaudeResponseIndex = i;
          break;
        }
      }
      
      if (firstClaudeResponseIndex === -1) {
        // No Claude response found after user message
        return '';
      }
      
      // Find where the text input box starts (╭ or ╰ characters)
      let textBoxStartIndex = lines.length;
      for (let i = firstClaudeResponseIndex; i < lines.length; i++) {
        if (lines[i].includes('╭') || lines[i].includes('╰')) {
          textBoxStartIndex = i;
          break;
        }
      }
      
      // Extract only Claude's responses (from first ⏺ to text box)
      const claudeResponseLines = lines.slice(firstClaudeResponseIndex, textBoxStartIndex);
      return claudeResponseLines.join('\n').trim();
      
    } catch (error) {
      console.error('Error extracting Claude response:', error);
      return '';
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
      path.resolve(__dirname, '../../scripts/mcp_bridge.js'),  // Fixed: Go up 2 levels from workflow/
      path.resolve(__dirname, '../scripts/mcp_bridge.js'),
      path.resolve(process.cwd(), 'scripts/mcp_bridge.js'),
      path.resolve(process.cwd(), 'src/scripts/mcp_bridge.js'),
      '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/scripts/mcp_bridge.js'  // Fixed: Correct path
    ];
    
    for (const bridgePath of possiblePaths) {
      if (require('fs').existsSync(bridgePath)) {
        console.log(`Found MCP bridge at: ${bridgePath}`);
        return bridgePath;
      }
    }
    
    // Fallback to relative path from workflow directory
    console.warn('Using fallback MCP bridge path');
    return path.resolve(__dirname, '../../scripts/mcp_bridge.js');
  }

  async readInstanceOutput() {
    return new Promise((resolve, reject) => {
      const command = 'node';
      const args = [
        this.mcpBridgePath,
        'read',
        JSON.stringify({
          instanceId: this.instanceId,
          lines: 50  // Increased to capture more output
        })
      ];
      
      // Set working directory to where MCP bridge expects to be
      const workingDir = path.dirname(this.mcpBridgePath);
      
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir  // Fix: Set correct working directory
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
          // Parse the JSON response - handle debug output from MCP bridge
          const lines = stdout.trim().split('\n');
          
          // Find the JSON line (should be the last line that starts with {)
          let jsonLine = null;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim().startsWith('{')) {
              jsonLine = lines[i];
              break;
            }
          }
          
          if (!jsonLine) {
            resolve(''); // No JSON found
            return;
          }
          
          const response = JSON.parse(jsonLine);
          
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