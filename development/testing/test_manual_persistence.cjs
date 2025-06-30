#!/usr/bin/env node

/**
 * Manual Persistent Monitoring Test
 * Test the persistent monitoring with an existing instance
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');

async function testPersistentMonitoring() {
  console.log('🧪 Manual Persistent Monitoring Test');
  console.log('===================================');
  console.log('');
  console.log('Using existing instance: spec_1_1_369242');
  console.log('');

  try {
    // Create persistent engine
    const workflowPath = path.join(__dirname, 'workflows/core/persistent_execute_compare_commit.yaml');
    const engine = new PersistentEngine(workflowPath, { debug: true });
    
    await engine.initialize();
    
    console.log('✅ Engine initialized');
    
    // Set up event handlers
    engine.on('stage_start', (stage) => {
      console.log(`🎯 Stage started: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Stage completed: ${stage.name || stage.id}`);
    });
    
    engine.on('blank_state_ready', (data) => {
      console.log(`🔄 Blank state ready: ${data.instanceId}`);
    });
    
    // Store the instance ID in context
    const instanceId = 'spec_1_1_369242';
    engine.context.set('vars.current_instance_id', instanceId);
    
    console.log('🔄 Starting persistent monitoring for EXECUTE_FINISHED...');
    
    // Start persistent monitoring
    await engine.startPersistentMonitoring(instanceId);
    
    console.log('✅ Persistent monitoring started!');
    console.log(`📋 The monitor is now watching instance ${instanceId} for "EXECUTE_FINISHED"`);
    console.log('');
    console.log('🎯 TEST INSTRUCTIONS:');
    console.log('1. The instance already has "EXECUTE_FINISHED" in its output');
    console.log('2. The monitor should detect it and trigger the compare stage');
    console.log('3. Watch this output for automatic stage progression');
    console.log('');
    console.log('⏳ Waiting for workflow progression...');
    
    // Keep the process alive to see the monitoring work
    let timeoutCounter = 0;
    const maxTimeout = 60; // 60 seconds
    
    const interval = setInterval(() => {
      timeoutCounter++;
      console.log(`⏰ Monitoring... ${timeoutCounter}/${maxTimeout}s`);
      
      if (timeoutCounter >= maxTimeout) {
        console.log('⏰ Test timeout reached');
        clearInterval(interval);
        process.exit(0);
      }
    }, 1000);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Test interrupted');
      clearInterval(interval);
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testPersistentMonitoring();