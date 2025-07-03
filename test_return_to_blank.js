#!/usr/bin/env node

/**
 * Test return_to_blank_state action directly
 */

import ActionExecutor from './src/workflow/action_executor.cjs';
import WorkflowContext from './src/workflow/workflow_context.cjs';

async function testReturnToBlankState() {
  console.log('🧪 Testing return_to_blank_state action...');
  
  try {
    // Create context and executor
    const context = new WorkflowContext({
      vars: {
        current_instance_id: 'spec_1_1_457749' // Use the last spawned instance
      }
    });
    
    const executor = new ActionExecutor(context, {
      debug: true
    });
    
    console.log('🔄 Testing return_to_blank_state action...');
    
    const action = {
      action: 'return_to_blank_state',
      target: 'current',
      message: '✅ Workflow complete. Ready for your next command.'
    };
    
    const result = await executor.execute(action);
    
    if (result.success) {
      console.log('✅ return_to_blank_state executed successfully!');
      console.log(`📍 Instance ${result.instanceId} returned to blank state`);
      console.log(`🎯 State: ${result.state}`);
      
      // Verify the instance is still active
      const listAction = { action: 'list' };
      const listResult = await executor.execute(listAction);
      
      if (listResult.success) {
        console.log(`📋 Found ${listResult.count} active instances`);
        const targetInstance = listResult.instances.find(i => i.instanceId === result.instanceId);
        if (targetInstance) {
          console.log('✅ Instance still active after blank state return');
          console.log('🎉 Persistent cycles capability validated!');
          return true;
        } else {
          console.log('❌ Instance not found after blank state return');
          return false;
        }
      } else {
        console.log('❌ Failed to list instances after blank state return');
        return false;
      }
    } else {
      console.log('❌ return_to_blank_state failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

testReturnToBlankState()
  .then(success => {
    console.log(`\n🎯 Persistent cycles test: ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal test error:', error);
    process.exit(1);
  });