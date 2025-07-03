#!/usr/bin/env node

/**
 * Workflow Runner - Entry point for executing YAML-based workflows
 * Supports portable execution from any directory
 */

const WorkflowEngine = require('./workflow_engine.cjs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node run_workflow.cjs <workflow.yaml> [options]

Options:
  --debug           Enable debug output
  --no-cleanup      Don't clean up instances after completion
  --timeout <sec>   Set default timeout in seconds
  --help, -h        Show this help message

Examples:
  node run_workflow.cjs workflows/examples/execute_compare_commit.yaml
  node run_workflow.cjs workflows/simple.yaml --debug
  node ~/.claude/user/tmux-claude-mcp-server/src/workflow/run_workflow.cjs ~/workflows/test.yaml
`);
    process.exit(0);
  }
  
  const workflowPath = args[0];
  const options = {
    debug: args.includes('--debug'),
    cleanup: !args.includes('--no-cleanup'),
    timeout: args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1]) : undefined
  };
  
  // Resolve workflow path - support both relative and absolute paths
  const resolvedPath = path.isAbsolute(workflowPath) 
    ? workflowPath 
    : path.resolve(process.cwd(), workflowPath);
  
  if (options.debug) {
    console.log(`Running workflow: ${resolvedPath}`);
    console.log(`Options:`, options);
    console.log(`Working directory: ${process.cwd()}`);
  }
  
  try {
    const engine = new WorkflowEngine(resolvedPath, options);
    
    // Set up event handlers for monitoring
    engine.on('workflow_start', (data) => {
      console.log(`🚀 Starting workflow: ${data.workflow} (${data.run_id})`);
    });
    
    engine.on('stage_start', (stage) => {
      console.log(`📍 Stage: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Stage completed: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_timeout', (stage) => {
      console.log(`⏰ Stage timeout: ${stage.name || stage.id}`);
    });
    
    engine.on('action_complete', (action, result) => {
      if (options.debug) {
        console.log(`✓ Action: ${action.action}`, result ? `-> ${JSON.stringify(result).slice(0, 100)}...` : '');
      }
    });
    
    engine.on('action_error', (action, error) => {
      console.error(`❌ Action failed: ${action.action}`, error.message);
    });
    
    engine.on('workflow_complete', (data) => {
      console.log(`🎉 Workflow completed: ${data.workflow}`);
      console.log(`Duration: ${Math.round(data.duration / 1000)}s`);
      if (options.debug) {
        console.log(`Stages executed: ${Object.keys(data.stages).length}`);
      }
    });
    
    engine.on('workflow_error', (error) => {
      console.error(`💥 Workflow failed:`, error.message);
      if (options.debug) {
        console.error(error.stack);
      }
    });
    
    // Start the workflow
    await engine.start();
    
    // Cleanup if requested
    if (options.cleanup) {
      await engine.cleanup();
    }
    
    console.log('\n✨ Workflow execution complete');
    
  } catch (error) {
    console.error('❌ Failed to run workflow:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Workflow interrupted');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Workflow terminated');
  process.exit(0);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});