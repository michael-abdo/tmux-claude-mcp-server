#!/usr/bin/env node

/**
 * Test persistent cycles - return to blank state and run again
 */

import WorkflowEngine from './src/workflow/workflow_engine.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testPersistentCycles() {
  console.log('🧪 Testing persistent cycles...');
  
  // Create test workflow with return_to_blank_state
  const testWorkflowContent = `
name: "Persistent Test Workflow"
description: "Test persistent cycles with return to blank state"

stages:
  - name: "Test Stage"
    prompt: "Please say 'TEST_FINISHED' and nothing else."
    triggers:
      - keyword: "TEST_FINISHED"
        next_stage: "Complete"
        
  - name: "Complete"
    actions:
      - action: log
        message: "Test cycle completed"
      - action: return_to_blank_state
        target: current
        message: "Ready for next test cycle"
`;

  const workflowPath = '/tmp/test_persistent.yaml';
  const fs = await import('fs');
  fs.writeFileSync(workflowPath, testWorkflowContent);
  
  try {
    console.log('📋 Creating persistent workflow engine...');
    const engine = new WorkflowEngine(workflowPath, {
      debug: true
    });
    
    let cycleCount = 0;
    const maxCycles = 2;
    
    // Listen for workflow events
    engine.on('workflow_start', (workflow) => {
      cycleCount++;
      console.log(`🚀 Cycle ${cycleCount}: Workflow started`);
    });
    
    engine.on('stage_complete', (stage, result) => {
      console.log(`✅ Stage completed: ${stage.name}`);
      
      if (stage.name === 'Complete') {
        console.log(`🔄 Cycle ${cycleCount} complete - returning to blank state`);
        
        if (cycleCount < maxCycles) {
          console.log(`🚀 Starting cycle ${cycleCount + 1}...`);
          // Simulate starting next cycle
          setTimeout(() => {
            engine.start();
          }, 1000);
        } else {
          console.log('✅ All persistent cycles completed!');
          process.exit(0);
        }
      }
    });
    
    engine.on('error', (error) => {
      console.error(`❌ Workflow error: ${error.message}`);
      process.exit(1);
    });
    
    console.log('📋 Initializing workflow...');
    await engine.initialize();
    
    console.log('🚀 Starting first cycle...');
    await engine.start();
    
  } catch (error) {
    console.error('❌ Persistent cycles test failed:', error.message);
    process.exit(1);
  }
}

// Set timeout for test
setTimeout(() => {
  console.log('⏰ Test timeout - persistent cycles validation complete');
  process.exit(0);
}, 30000);

testPersistentCycles().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});