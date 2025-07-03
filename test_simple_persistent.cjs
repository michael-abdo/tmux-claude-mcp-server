#!/usr/bin/env node

/**
 * Simple test to verify persistent workflow keyword detection and automatic progression
 */

const path = require('path');
const { spawn } = require('child_process');

// Helper to call MCP bridge
async function mcpBridge(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [
      path.join(__dirname, 'scripts', 'mcp_bridge.js'),
      command,
      JSON.stringify(args)
    ]);
    
    let output = '';
    proc.stdout.on('data', d => output += d);
    proc.stderr.on('data', d => console.error(`[MCP Error] ${d}`));
    
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`MCP failed with code ${code}`));
      else {
        try {
          resolve(JSON.parse(output));
        } catch (e) {
          resolve(output);
        }
      }
    });
  });
}

async function test() {
  console.log('🧪 Simple Persistent Workflow Test\n');
  
  try {
    // 1. Spawn a test instance
    console.log('1️⃣ Spawning test instance...');
    const spawnResult = await mcpBridge('spawn', {
      role: 'specialist',
      workDir: process.cwd(),
      context: 'Test instance for persistent workflow'
    });
    
    const instanceId = spawnResult.instanceId;
    console.log(`✅ Spawned instance: ${instanceId}\n`);
    
    // 2. Wait a moment for instance to be ready
    await new Promise(r => setTimeout(r, 3000));
    
    // 3. Send a command ending with EXECUTE_FINISHED
    console.log('2️⃣ Sending command with EXECUTE_FINISHED...');
    await mcpBridge('send', {
      instanceId,
      text: 'Please list files: ls -la\n\nSAY EXECUTE_FINISHED when done'
    });
    
    // 4. Monitor output over time
    console.log('\n3️⃣ Monitoring output for automatic progression...\n');
    
    let lastOutput = '';
    let iterations = 0;
    const maxIterations = 15; // 30 seconds max
    
    while (iterations < maxIterations) {
      await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      
      const readResult = await mcpBridge('read', {
        instanceId,
        lines: 30
      });
      
      if (readResult.output && readResult.output !== lastOutput) {
        console.log(`--- Iteration ${iterations + 1} ---`);
        console.log(readResult.output.slice(lastOutput.length));
        lastOutput = readResult.output;
        
        // Check for keywords
        if (readResult.output.includes('EXECUTE_FINISHED')) {
          console.log('✅ EXECUTE_FINISHED detected');
        }
        if (readResult.output.includes('analyze and compare')) {
          console.log('✅ Compare stage prompt sent automatically');
        }
        if (readResult.output.includes('COMPARE_FINISHED')) {
          console.log('✅ COMPARE_FINISHED detected');
        }
        if (readResult.output.includes('git status')) {
          console.log('✅ Commit stage prompt sent automatically');
        }
        if (readResult.output.includes('COMMIT_FINISHED')) {
          console.log('✅ COMMIT_FINISHED detected');
        }
        if (readResult.output.includes('Ready for your next command')) {
          console.log('✅ Returned to blank state');
          break;
        }
      }
      
      iterations++;
    }
    
    // 5. Cleanup
    console.log('\n4️⃣ Cleaning up...');
    await mcpBridge('terminate', { instanceId });
    console.log('✅ Instance terminated\n');
    
    console.log('Test complete! Check output above to verify automatic progression.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

test().catch(console.error);