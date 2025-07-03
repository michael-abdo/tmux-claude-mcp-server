#!/usr/bin/env node

/**
 * Test AUTONOMOUS ORCHESTRATION with authenticated Claude instance
 * This tests if the workflow engine can automatically progress stages
 */

import WorkflowEngine from './src/workflow/workflow_engine.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testAutonomousOrchestration() {
  console.log('🎯 TESTING AUTONOMOUS ORCHESTRATION WITH FRESH INSTANCE');
  console.log('Using FRESH Claude instance: spec_1_1_596958');
  
  const workflowPath = path.join(__dirname, 'workflows/examples/execute_compare_commit.yaml');
  
  try {
    const engine = new WorkflowEngine(workflowPath, {
      debug: true
    });
    
    // Track orchestration events
    engine.on('stage_start', (stage) => {
      console.log(`🚀 AUTO: Stage started: ${stage.name}`);
    });
    
    engine.on('stage_complete', (stage, result) => {
      console.log(`✅ AUTO: Stage completed: ${stage.name}`);
    });
    
    engine.on('workflow_complete', (result) => {
      console.log(`🎉 AUTO: Workflow completed successfully!`);
      process.exit(0);
    });
    
    engine.on('error', (error) => {
      console.error(`❌ AUTO: Workflow error: ${error.message}`);
      process.exit(1);
    });
    
    // Initialize workflow
    await engine.initialize();
    
    // Override getOrCreateInstance to use fresh Claude instance
    engine.getOrCreateInstance = async (stage) => {
      console.log('🔧 Using FRESH Claude instance: spec_1_1_596958');
      engine.activeInstances.set('spec_1_1_596958', {
        role: 'specialist',
        stage_id: stage.id,
        created_at: Date.now()
      });
      return 'spec_1_1_596958';
    };
    
    console.log('🚀 Starting autonomous orchestration test...');
    
    // Start first stage - this should automatically:
    // 1. Send Execute prompt to Claude
    // 2. Monitor for EXECUTE_FINISHED keyword  
    // 3. Automatically advance to Compare stage
    // 4. Send Compare prompt
    // 5. Monitor for COMPARE_FINISHED
    // 6. Automatically advance to Commit stage
    // 7. Send Commit prompt
    // 8. Monitor for COMMIT_FINISHED
    // 9. Complete workflow
    
    const firstStage = engine.config.stages[0];
    await engine.executeStage(firstStage);
    
    // Keep process alive to observe autonomous behavior
    setTimeout(() => {
      console.log('⏰ Test timeout - orchestration did not complete automatically');
      process.exit(1);
    }, 180000); // 3 minutes
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testAutonomousOrchestration().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});