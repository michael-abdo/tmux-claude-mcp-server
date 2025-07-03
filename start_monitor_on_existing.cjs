#!/usr/bin/env node

/**
 * Start persistent monitoring on an existing instance
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');

async function startMonitoringOnExisting() {
  console.log('🎯 Starting Persistent Workflow Monitor on Existing Instance\n');
  
  // Use the existing instance
  const instanceId = 'spec_1_1_018229';
  console.log(`📋 Target instance: ${instanceId}`);
  
  // Create minimal workflow config
  const workflowPath = path.join(__dirname, 'workflows/core/persistent_execute_compare_commit.yaml');
  
  try {
    const engine = new PersistentEngine(workflowPath, { debug: true });
    await engine.initialize();
    
    console.log('🔄 Setting up persistent monitoring...');
    
    // Store the instance ID in context
    engine.context.set('vars.current_instance_id', instanceId);
    
    // Start monitoring directly
    await engine.startPersistentMonitoring(instanceId);
    
    console.log(`✅ Persistent monitoring started on ${instanceId}`);
    console.log('📋 Now give the instance a command ending with "SAY EXECUTE_FINISHED"');
    console.log('🔗 Attach with: tmux attach -t claude_' + instanceId);
    
    // Set up event handlers
    engine.on('stage_start', (stage) => {
      console.log(`📍 Stage started: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Stage completed: ${stage.name || stage.id}`);
    });
    
    engine.on('blank_state_ready', (data) => {
      console.log(`🔄 Returned to blank state - ready for next command!`);
    });
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping persistent workflow monitor...');
      process.exit(0);
    });
    
    console.log('\n⏸️  Monitor running... Press Ctrl+C to stop\n');
    
  } catch (error) {
    console.error('❌ Failed to start monitoring:', error.message);
    process.exit(1);
  }
}

startMonitoringOnExisting().catch(console.error);