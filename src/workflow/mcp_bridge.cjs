/**
 * MCP Bridge Wrapper for Workflow System
 * Provides a clean interface to the existing MCP bridge
 */

const { spawn } = require('child_process');
const path = require('path');

class MCPBridge {
  constructor(bridgeScript = null) {
    // Use the existing MCP bridge script
    this.bridgeScript = bridgeScript || path.join(__dirname, '../../scripts/mcp_bridge.js');
  }

  async execute(command, params = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.bridgeScript, command, JSON.stringify(params)], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Bridge command failed: ${stderr || stdout}`));
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          // If not JSON, return raw output
          resolve({ success: true, output: stdout.trim() });
        }
      });

      child.on('error', reject);
    });
  }

  async spawn(params) {
    return this.execute('spawn', params);
  }

  async send(params) {
    return this.execute('send', params);
  }

  async read(params) {
    return this.execute('read', params);
  }

  async list(params) {
    return this.execute('list', params);
  }

  async terminate(params) {
    return this.execute('terminate', params);
  }

  async restart(params) {
    return this.execute('restart', params);
  }
}

module.exports = MCPBridge;