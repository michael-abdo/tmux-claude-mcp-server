#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runWorkflow() {
  console.log('🚀 Starting simple execute_compare_commit workflow...\n');
  
  // Run the workflow with longer timeout
  const workflowPath = path.join(__dirname, 'workflows/examples/execute_compare_commit.yaml');
  const runnerPath = path.join(__dirname, 'src/workflow/run_workflow.cjs');
  
  console.log(`Running: node ${runnerPath} ${workflowPath}`);
  
  const proc = spawn('node', [runnerPath, workflowPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  // Give it 5 minutes to complete
  const timeout = setTimeout(() => {
    console.log('\n⏰ Workflow timeout reached (5 minutes), killing process...');
    proc.kill();
  }, 300000);
  
  proc.on('close', (code) => {
    clearTimeout(timeout);
    console.log(`\nWorkflow process exited with code ${code}`);
    
    if (code === 0) {
      console.log('✅ Workflow completed successfully!');
    } else {
      console.log('❌ Workflow failed');
    }
    
    // Check for any spawned instances
    const listProc = spawn('node', [
      path.join(__dirname, 'scripts/mcp_bridge.js'),
      'list',
      '{}'
    ]);
    
    let listOutput = '';
    listProc.stdout.on('data', (data) => {
      listOutput += data.toString();
    });
    
    listProc.on('close', () => {
      try {
        const lines = listOutput.split('\n');
        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            const result = JSON.parse(line);
            if (result.success && result.instances && result.instances.length > 0) {
              console.log(`\n📋 Active instances: ${result.instances.length}`);
              result.instances.forEach(inst => {
                console.log(`  - ${inst.instanceId} (attach with: tmux attach -t claude_${inst.instanceId})`);
              });
            }
            break;
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    });
  });
}

runWorkflow().catch(console.error);