#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing simple workflow spawning...\n');

// Spawn a Claude instance manually
const mcpBridge = path.join(__dirname, 'scripts', 'mcp_bridge.js');

console.log('1. Spawning instance manually...');
const spawnProc = spawn('node', [mcpBridge, 'spawn', JSON.stringify({
  role: 'specialist',
  workDir: __dirname,
  context: 'Manual test spawn'
})]);

let output = '';
spawnProc.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

spawnProc.stderr.on('data', (data) => {
  process.stderr.write(data);
});

spawnProc.on('close', (code) => {
  console.log(`\nSpawn process exited with code ${code}`);
  
  if (code === 0) {
    // Try to extract instance ID
    try {
      const lines = output.split('\n');
      for (const line of lines.reverse()) {
        if (line.trim().startsWith('{')) {
          const result = JSON.parse(line);
          if (result.success && result.result && result.result.instanceId) {
            console.log(`\n✅ Instance spawned successfully: ${result.result.instanceId}`);
            console.log('You can now attach with: tmux attach -t claude_' + result.result.instanceId);
            break;
          }
        }
      }
    } catch (e) {
      console.error('Failed to parse result:', e);
    }
  }
});

// Set a timeout
setTimeout(() => {
  console.log('\n⏰ Timeout reached, killing spawn process...');
  spawnProc.kill();
}, 300000); // 5 minutes