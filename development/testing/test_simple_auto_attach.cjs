#!/usr/bin/env node

/**
 * Simple Auto-Attach Test - Test with existing session
 */

const AutoAttach = require('./src/workflow/auto_attach.cjs');

async function testSimpleAutoAttach() {
  console.log('🧪 Simple Auto-Attach Test');
  console.log('=' .repeat(50));
  console.log('');

  // Use the existing instance
  const instanceId = 'spec_1_1_049647';
  console.log(`📋 Testing with existing instance: ${instanceId}`);
  
  try {
    const autoAttach = new AutoAttach({ debug: true });
    
    // Step 1: Verify session exists
    console.log('🔍 Step 1: Verifying session exists...');
    const sessionExists = await autoAttach.verifySessionExists(`claude_${instanceId}`);
    
    if (sessionExists) {
      console.log('✅ Session exists');
    } else {
      console.log('❌ Session does not exist');
      return;
    }
    
    // Step 2: Check session activity
    console.log('🔍 Step 2: Checking session activity...');
    const hasActivity = await autoAttach.checkSessionActivity(`claude_${instanceId}`);
    
    if (hasActivity) {
      console.log('✅ Session has activity');
    } else {
      console.log('ℹ️  Session exists but may not have Claude activity yet');
    }
    
    // Step 3: Test auto-attach
    console.log('🚀 Step 3: Testing auto-attach...');
    const attachSuccess = await autoAttach.attachToSession(instanceId);
    
    if (attachSuccess) {
      console.log('🎉 Auto-attach successful! New terminal should have opened.');
    } else {
      console.log('⚠️  Auto-attach failed or not supported on this platform');
    }
    
    // Step 4: Show manual instructions anyway
    console.log('');
    console.log('🔗 Manual attachment command:');
    console.log(`tmux attach -t claude_${instanceId}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleAutoAttach();