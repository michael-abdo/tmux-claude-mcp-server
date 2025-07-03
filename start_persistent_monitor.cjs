#!/usr/bin/env node

/**
 * Start persistent monitoring with no timeout - for testing
 */

const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');
const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');

async function startPersistentMonitor() {
  console.log('🎯 Starting Persistent Monitor (No Timeout)\n');
  
  const instanceId = 'spec_1_1_018229';
  console.log(`📋 Monitoring instance: ${instanceId}`);
  
  try {
    // Create workflow engine
    const workflowPath = path.join(__dirname, 'workflows/core/persistent_execute_compare_commit.yaml');
    const engine = new PersistentEngine(workflowPath, { debug: true });
    await engine.initialize();
    
    // Set up context
    engine.context.set('vars.current_instance_id', instanceId);
    
    console.log('🔄 Starting persistent monitoring with NO timeout...');
    
    // Create monitor with no timeout
    const monitor = new KeywordMonitor({
      instanceId: instanceId,
      keyword: 'EXECUTE_FINISHED',
      pollInterval: 2,
      timeout: 0, // No timeout - run forever
      simpleMode: true
    });
    
    monitor.on('keyword_detected', async (output) => {
      console.log('\n🎯 EXECUTE_FINISHED detected! Starting workflow cycle...');
      
      try {
        // Stop this monitor
        monitor.stop();
        
        // Start the workflow cycle
        const compareStage = engine.config.stages.find(s => s.id === 'compare_stage');
        if (compareStage) {
          await engine.executeStage(compareStage, instanceId);
        }
        
        // After workflow completes, restart monitoring
        console.log('\n🔄 Workflow cycle complete, restarting monitoring...');
        setTimeout(() => {
          startPersistentMonitor(); // Restart the whole process
        }, 2000);
        
      } catch (error) {
        console.error('❌ Workflow error:', error.message);
        // Restart monitoring even on error
        setTimeout(() => {
          startPersistentMonitor();
        }, 5000);
      }
    });
    
    monitor.on('error', (error) => {
      console.error('❌ Monitor error:', error.message);
      // Restart on error
      setTimeout(() => {
        startPersistentMonitor();
      }, 5000);
    });
    
    // Set up workflow event handlers
    engine.on('stage_start', (stage) => {
      console.log(`📍 Stage started: ${stage.name}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Stage completed: ${stage.name}`);
    });
    
    engine.on('blank_state_ready', () => {
      console.log('🔄 Returned to blank state - ready for next command!');
    });
    
    console.log('📡 Monitor started - give Claude a command ending with "SAY EXECUTE_FINISHED"');
    console.log('🔗 Attach with: tmux attach -t claude_spec_1_1_018229\n');
    
    monitor.start();
    
  } catch (error) {
    console.error('❌ Failed to start monitor:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping persistent monitor...');
  process.exit(0);
});

startPersistentMonitor();