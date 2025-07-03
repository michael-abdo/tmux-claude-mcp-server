#!/usr/bin/env node

/**
 * Test workflow engine direct execution to see if it sends initial prompts
 */

import WorkflowEngine from './src/workflow/workflow_engine.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testWorkflowEngineDirect() {
  console.log('🧪 Testing workflow engine direct execution...');
  
  const workflowPath = path.join(__dirname, 'workflows/examples/execute_compare_commit.yaml');
  
  try {
    const engine = new WorkflowEngine(workflowPath, {
      debug: true
    });
    
    // Listen for all events to see workflow progression
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
      process.exit(0);
    });
    
    engine.on('error', (error) => {
      console.error(`❌ Workflow error: ${error.message}`);
      console.error('Stack:', error.stack);
      process.exit(1);
    });
    
    // Initialize and start
    console.log('📋 Initializing workflow...');
    await engine.initialize();
    
    console.log('🚀 Starting workflow...');
    const result = await engine.start();
    
    console.log('📊 Workflow start result:', result);
    
    // Keep process alive to see if workflow continues
    setTimeout(() => {
      console.log('⏰ Test timeout after 3 minutes');
      process.exit(1);
    }, 180000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testWorkflowEngineDirect().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});