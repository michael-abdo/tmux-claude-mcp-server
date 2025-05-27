#!/usr/bin/env node

/**
 * Test script to verify MCP tools availability in Claude instances
 */

console.log('=== MCP Tools Availability Test ===\n');

// Test 1: Check if we're in a Claude environment
console.log('1. Environment Check:');
console.log('   - Process title:', process.title);
console.log('   - Node version:', process.version);
console.log('   - Platform:', process.platform);
console.log('   - Current directory:', process.cwd());

// Test 2: Check for MCP-specific environment variables
console.log('\n2. MCP Environment Variables:');
const mcpVars = Object.keys(process.env).filter(key => 
  key.includes('MCP') || key.includes('CLAUDE') || key.includes('TMUX')
);
if (mcpVars.length > 0) {
  mcpVars.forEach(key => {
    console.log(`   - ${key}: ${process.env[key]}`);
  });
} else {
  console.log('   - No MCP-related environment variables found');
}

// Test 3: Check for available global objects
console.log('\n3. Global Objects Check:');
const globalKeys = Object.keys(global).filter(key => 
  key.toLowerCase().includes('mcp') || 
  key.toLowerCase().includes('tool') ||
  key.toLowerCase().includes('server')
);
if (globalKeys.length > 0) {
  console.log('   - Found global objects:', globalKeys);
} else {
  console.log('   - No MCP-related global objects found');
}

// Test 4: Check for MCP server connection
console.log('\n4. MCP Server Connection Test:');
try {
  // Try to load the MCP server module if available
  const path = require('path');
  const serverPath = path.join(__dirname, 'index.js');
  console.log(`   - Attempting to load MCP server from: ${serverPath}`);
  
  const fs = require('fs');
  if (fs.existsSync(serverPath)) {
    console.log('   - MCP server file exists');
    
    // Check if server is already running by looking at the process
    const { exec } = require('child_process');
    exec('ps aux | grep -E "node.*tmux.*mcp.*server" | grep -v grep', (error, stdout) => {
      if (stdout.trim()) {
        console.log('   - MCP server process found running:');
        console.log(`     ${stdout.trim()}`);
      } else {
        console.log('   - No running MCP server process detected');
      }
    });
  } else {
    console.log('   - MCP server file not found');
  }
} catch (error) {
  console.log('   - Error checking MCP server:', error.message);
}

// Test 5: Check tmux session integration
console.log('\n5. Tmux Integration Test:');
const { execSync } = require('child_process');
try {
  const tmuxSessions = execSync('tmux list-sessions 2>/dev/null || echo "No tmux sessions"', 
    { encoding: 'utf8' }
  );
  console.log('   - Tmux sessions:', tmuxSessions.trim());
} catch (error) {
  console.log('   - Tmux not available or no sessions');
}

// Test 6: Check for MCP tool definitions
console.log('\n6. MCP Tool Definitions:');
try {
  const toolsPath = path.join(__dirname, 'lib/tmux-tools.js');
  if (fs.existsSync(toolsPath)) {
    console.log('   - MCP tools file exists at:', toolsPath);
    const tools = require(toolsPath);
    if (tools && tools.tools) {
      console.log('   - Available MCP tools:');
      tools.tools.forEach(tool => {
        console.log(`     * ${tool.name}: ${tool.description.split('\n')[0]}`);
      });
    }
  } else {
    console.log('   - MCP tools file not found');
  }
} catch (error) {
  console.log('   - Error loading MCP tools:', error.message);
}

console.log('\n=== Test Complete ===');