#!/usr/bin/env node

/**
 * Test complete workflow execution with all stage transitions
 */

import WorkflowEngine from './src/workflow/workflow_engine.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testCompleteWorkflow() {
  console.log('🧪 Testing complete workflow execution...');
  
  const workflowPath = path.join(__dirname, 'workflows/examples/execute_compare_commit.yaml');
  
  try {
    const engine = new WorkflowEngine(workflowPath, {
      debug: true
    });
    
    // Listen for workflow events
    engine.on('workflow_start', (workflow) => {
      console.log(`🚀 Workflow started: ${workflow.name}`);
    });
    
    engine.on('stage_start', (stage) => {
      console.log(`📍 Stage started: ${stage.name}`);
    });
    
    engine.on('stage_complete', (stage, result) => {
      console.log(`✅ Stage completed: ${stage.name}`);
    });
    
    engine.on('workflow_complete', (result) => {
      console.log(`🎉 Workflow completed successfully!`);
    });
    
    engine.on('error', (error) => {
      console.error(`❌ Workflow error: ${error.message}`);
    });
    
    console.log('📋 Initializing workflow...');
    await engine.initialize();
    
    console.log('🚀 Starting workflow execution...');
    await engine.start();
    
    console.log('✅ Workflow test completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

testCompleteWorkflow()
  .then(success => {
    console.log(`\n🎯 Test result: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });