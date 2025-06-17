#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Debug: What does the monitor actually read?\n');

const mcpBridge = spawn('node', [
  path.join(__dirname, 'scripts', 'mcp_bridge.js'),
  'read',
  JSON.stringify({ instanceId: 'spec_1_1_625013', lines: 20 })
]);

let output = '';
mcpBridge.stdout.on('data', (data) => {
  output += data.toString();
});

mcpBridge.on('close', () => {
  console.log('Raw MCP bridge output:');
  console.log('='.repeat(50));
  console.log(output);
  console.log('='.repeat(50));
  
  try {
    const parsed = JSON.parse(output);
    if (parsed.output) {
      console.log('\nParsed output content:');
      console.log(parsed.output);
      console.log('\nSearching for EXECUTE_FINISHED:');
      const hasKeyword = parsed.output.includes('EXECUTE_FINISHED');
      console.log('Found:', hasKeyword);
      
      if (hasKeyword) {
        const matches = parsed.output.match(/EXECUTE_FINISHED/g);
        console.log('Number of matches:', matches ? matches.length : 0);
      }
    }
  } catch (e) {
    console.error('Failed to parse JSON:', e.message);
  }
});