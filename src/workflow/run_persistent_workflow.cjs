#!/usr/bin/env node

/**
 * Persistent Workflow Runner - Starts infinite loop execute-compare-commit workflow
 */

const PersistentEngine = require('./persistent_engine.cjs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Persistent Workflow Runner

Usage: node run_persistent_workflow.cjs [workflow.yaml] [options]

Options:
  --debug           Enable debug output
  --auto-attach     Auto-attach to tmux session when ready
  --no-cleanup      Don't clean up instances after completion
  --timeout <sec>   Set default timeout in seconds
  --help, -h        Show this help message

Default workflow: workflows/core/persistent_execute_compare_commit.yaml

Examples:
  node run_persistent_workflow.cjs
  node run_persistent_workflow.cjs --debug
  node run_persistent_workflow.cjs --auto-attach
  node run_persistent_workflow.cjs workflows/core/persistent_execute_compare_commit.yaml
`);
    process.exit(0);
  }
  
  // Extract non-option arguments (workflow path)
  const nonOptionArgs = args.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
  const workflowPath = nonOptionArgs[0] || path.join(__dirname, '../../workflows/core/persistent_execute_compare_commit.yaml');
  
  const options = {
    debug: args.includes('--debug'),
    cleanup: !args.includes('--no-cleanup'),
    timeout: args.includes('--timeout') ? parseInt(args[args.indexOf('--timeout') + 1]) : undefined,
    autoAttach: args.includes('--auto-attach')
  };
  
  // Resolve workflow path - support both relative and absolute paths
  const resolvedPath = path.isAbsolute(workflowPath) 
    ? workflowPath 
    : path.resolve(process.cwd(), workflowPath);
  
  if (options.debug) {
    console.log(`Running persistent workflow: ${resolvedPath}`);
    console.log(`Options:`, options);
    console.log(`Working directory: ${process.cwd()}`);
  }
  
  try {
    const engine = new PersistentEngine(resolvedPath, options);
    
    // Set up event handlers for monitoring
    engine.on('workflow_start', (data) => {
      console.log(`🚀 Starting persistent workflow: ${data.workflow} (${data.run_id})`);
    });
    
    engine.on('blank_state_ready', async (data) => {
      console.log(`✅ Instance ${data.instanceId} ready for commands!`);
      console.log(`📋 Type commands ending with "SAY EXECUTE_FINISHED" to trigger workflow cycles`);
      console.log(`🔗 Attach to session: tmux attach -t claude_${data.instanceId}`);
      
      // Auto-attach if requested
      if (options.autoAttach) {
        console.log(`🚀 Auto-attaching to session...`);
        const AutoAttach = require('./auto_attach.cjs');
        const autoAttach = new AutoAttach({ debug: options.debug });
        
        try {
          // Wait a moment for the session to be fully ready
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const success = await autoAttach.attachToSession(data.instanceId);
          if (success) {
            console.log(`✅ Auto-attach successful!`);
          } else {
            console.log(`⚠️  Auto-attach failed, use manual attachment above`);
          }
        } catch (error) {
          console.error(`❌ Auto-attach error:`, error.message);
          console.log(`⚠️  Use manual attachment: tmux attach -t claude_${data.instanceId}`);
        }
      }
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
    
    engine.on('workflow_error', (error) => {
      console.error(`💥 Workflow failed:`, error.message);
      if (options.debug) {
        console.error(error.stack);
      }
    });
    
    // Start the persistent workflow
    await engine.start();
    
    console.log('\n🔄 Persistent workflow is running...');
    console.log('Press Ctrl+C to stop (instances will remain active)');
    
    // Keep the process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping persistent workflow monitor...');
      if (options.cleanup) {
        await engine.cleanup();
      }
      console.log('✅ Monitor stopped (instances may still be running)');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Workflow terminated');
      if (options.cleanup) {
        await engine.cleanup();
      }
      process.exit(0);
    });
    
    // Keep process alive
    setInterval(() => {
      // Just stay alive - the engine handles everything
    }, 30000);
    
  } catch (error) {
    console.error('❌ Failed to run persistent workflow:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('unhandledRejection', (error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});