#!/usr/bin/env node

/**
 * Test stage transitions Execute → Compare → Commit
 */

import WorkflowEngine from './src/workflow/workflow_engine.cjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testStageTransitions() {
  console.log('🧪 Testing stage transitions Execute → Compare → Commit...');
  
  const workflowPath = path.join(__dirname, 'workflows/examples/execute_compare_commit.yaml');
  
  try {
    const engine = new WorkflowEngine(workflowPath, {
      debug: true,
      skipSpawn: true // Skip actual spawning for testing
    });
    
    console.log('📋 Loading workflow...');
    await engine.initialize();
    
    console.log('🚀 Starting workflow...');
    
    // Test stage 1: Execute
    console.log('\n=== Testing Execute Stage ===');
    const currentStage = engine.getCurrentStage();
    console.log(`Current stage: ${currentStage.name}`);
    
    if (currentStage.name === 'Execute') {
      console.log('✅ Execute stage loaded correctly');
      
      // Simulate keyword detection
      console.log('🔍 Simulating EXECUTE_FINISHED detection...');
      engine.handleKeywordDetection('EXECUTE_FINISHED');
      
      // Check if transitioned to Compare
      const nextStage = engine.getCurrentStage();
      if (nextStage.name === 'Compare') {
        console.log('✅ Transitioned Execute → Compare');
        
        // Test stage 2: Compare
        console.log('\n=== Testing Compare Stage ===');
        console.log('🔍 Simulating COMPARE_FINISHED detection...');
        engine.handleKeywordDetection('COMPARE_FINISHED');
        
        // Check if transitioned to Commit
        const finalStage = engine.getCurrentStage();
        if (finalStage.name === 'Commit') {
          console.log('✅ Transitioned Compare → Commit');
          
          // Test stage 3: Complete
          console.log('\n=== Testing Commit Stage ===');
          console.log('🔍 Simulating COMMIT_FINISHED detection...');
          engine.handleKeywordDetection('COMMIT_FINISHED');
          
          console.log('✅ All stage transitions validated!');
          return true;
        } else {
          console.log('❌ Failed to transition Compare → Commit');
          return false;
        }
      } else {
        console.log('❌ Failed to transition Execute → Compare');
        return false;
      }
    } else {
      console.log('❌ Initial stage is not Execute');
      return false;
    }
  } catch (error) {
    console.error('❌ Stage transition test failed:', error.message);
    return false;
  }
}

testStageTransitions()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });