#!/usr/bin/env node

/**
 * Run Workflow CLI - Execute workflow definitions
 */

const path = require('path');
const WorkflowEngine = require('./workflow_engine.cjs');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node run_workflow.cjs <workflow-file.yaml>');
    console.log('\nExample:');
    console.log('  node run_workflow.cjs workflows/code_review.yaml');
    process.exit(1);
  }
  
  const workflowPath = path.resolve(args[0]);
  
  console.log('='.repeat(60));
  console.log('Workflow Runner');
  console.log('='.repeat(60));
  console.log(`Workflow file: ${workflowPath}`);
  console.log('');
  
  const engine = new WorkflowEngine(workflowPath);
  
  // Set up event handlers for monitoring
  engine.on('workflow_start', (data) => {
    console.log(`\n✅ Workflow started: ${data.workflow} (${data.run_id})`);
  });
  
  engine.on('stage_start', (stage) => {
    console.log(`\n📋 Stage started: ${stage.name || stage.id}`);
  });
  
  engine.on('stage_complete', (stage) => {
    console.log(`✅ Stage completed: ${stage.name || stage.id}`);
  });
  
  engine.on('stage_timeout', (stage) => {
    console.log(`⏰ Stage timed out: ${stage.name || stage.id}`);
  });
  
  engine.on('action_start', (action) => {
    console.log(`  → ${action.action}${action.script ? `: ${action.script}` : ''}`);
  });
  
  engine.on('action_complete', (action, result) => {
    if (result && action.output_var) {
      console.log(`    ✓ Stored result in: ${action.output_var}`);
    }
  });
  
  engine.on('action_error', (action, error) => {
    console.log(`    ✗ Error: ${error.message}`);
  });
  
  engine.on('workflow_complete', (data) => {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Workflow completed successfully!`);
    console.log(`Duration: ${Math.round(data.duration / 1000)}s`);
    console.log(`Stages completed: ${data.stages ? Object.keys(data.stages).length : 0}`);
    console.log('='.repeat(60));
  });
  
  engine.on('workflow_error', (error) => {
    console.error('\n❌ Workflow failed:', error.message);
  });
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down workflow...');
    await engine.cleanup();
    process.exit(0);
  });
  
  try {
    await engine.start();
  } catch (error) {
    console.error('\nWorkflow execution failed:', error);
    await engine.cleanup();
    process.exit(1);
  }
}

main().catch(console.error);