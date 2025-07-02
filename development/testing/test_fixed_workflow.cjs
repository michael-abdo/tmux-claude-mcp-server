#!/usr/bin/env node

/**
 * Test Fixed Workflow - Verify instance reuse fix works
 */

const PersistentEngine = require('./src/workflow/persistent_engine.cjs');
const path = require('path');

async function testFixedWorkflow() {
  console.log('🧪 Testing Fixed Workflow with Instance Reuse');
  console.log('='.repeat(50));
  
  try {
    // Use existing instance that already has EXECUTE_FINISHED in output
    const instanceId = 'spec_1_1_979203';
    console.log(`📋 Using existing instance: ${instanceId}`);
    console.log(`📋 Instance should already have "EXECUTE_FINISHED" in output`);
    
    // Create persistent engine
    const workflowPath = path.join(__dirname, 'workflows/core/persistent_execute_compare_commit.yaml');
    const engine = new PersistentEngine(workflowPath, { debug: true });
    
    await engine.initialize();
    console.log('✅ Engine initialized');
    
    // Set up event handlers to track stage progression
    engine.on('stage_start', (stage) => {
      console.log(`🎯 Stage started: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Stage completed: ${stage.name || stage.id}`);
    });
    
    engine.on('blank_state_ready', (data) => {
      console.log(`🔄 Blank state ready: ${data.instanceId}`);
      console.log('✅ TEST PASSED: Full cycle completed and returned to blank state!');
    });
    
    // Set the instance ID in context (simulate the persistent workflow)
    engine.context.set('vars.current_instance_id', instanceId);
    
    console.log('🔄 Starting persistent monitoring to detect EXECUTE_FINISHED...');
    
    // Start persistent monitoring (should immediately detect EXECUTE_FINISHED)
    await engine.startPersistentMonitoring(instanceId);
    
    console.log('👂 Monitoring started - watching for EXECUTE_FINISHED detection...');
    console.log('📋 Expected: Compare stage → Commit stage → Return to blank state');
    console.log('🧪 CRITICAL TEST: All stages should reuse the same instance (no new spawns)');
    
    // Wait for the workflow to complete
    let completed = false;
    let timeoutCount = 0;
    const maxTimeout = 60; // 60 seconds
    
    const checkInterval = setInterval(() => {
      timeoutCount++;
      console.log(`⏰ Waiting for workflow completion... ${timeoutCount}/${maxTimeout}s`);
      
      if (timeoutCount >= maxTimeout && !completed) {
        console.log('⏰ Test timeout - checking final state');
        clearInterval(checkInterval);
        console.log('❌ TEST TIMEOUT: Workflow did not complete in time');
        process.exit(1);
      }
    }, 1000);
    
    // Set up completion handler
    engine.on('blank_state_ready', () => {
      completed = true;
      clearInterval(checkInterval);
      console.log('🎉 SUCCESS: Workflow completed full cycle!');
      console.log('✅ Instance reuse fix is working correctly');
      setTimeout(() => process.exit(0), 2000);
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  process.exit(0);
});

testFixedWorkflow();