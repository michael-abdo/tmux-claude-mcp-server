#!/usr/bin/env node
/**
 * Test Chain Keyword Monitor - Validation script
 * 
 * Tests the chain keyword monitor with mock data to ensure it works correctly
 */

import { ChainKeywordMonitor, loadConfig } from './chain_keyword_monitor.js';
import fs from 'fs';

async function testChainMonitor() {
  console.log('🧪 Testing Chain Keyword Monitor...\n');
  
  let testCount = 0;
  let passCount = 0;
  
  function assert(condition, message) {
    testCount++;
    if (condition) {
      console.log(`✅ ${message}`);
      passCount++;
    } else {
      console.log(`❌ ${message}`);
    }
  }
  
  try {
    // Test 1: Config Loading
    console.log('📋 Test 1: Configuration Loading');
    const config = await loadConfig('./example_chain_config.json');
    assert(config.instanceId === 'spec_1_1_397923', 'Config loaded with correct instanceId');
    assert(Array.isArray(config.chains) && config.chains.length === 4, 'Config has 4 chains');
    assert(config.chains[0].keyword === 'STAGE1_COMPLETE', 'First chain has correct keyword');
    
    // Test 2: Monitor Instantiation
    console.log('\n📋 Test 2: Monitor Instantiation');
    
    // Create mock config with current instance
    const mockConfig = {
      instanceId: 'test_instance_123',
      chains: [
        {
          keyword: 'TEST_COMPLETE',
          instruction: 'Great! Now do the next step.',
          nextKeyword: 'FINAL_COMPLETE'
        },
        {
          keyword: 'FINAL_COMPLETE',
          instruction: 'All done!'
        }
      ],
      options: {
        pollInterval: 1,
        timeout: 10,
        retryAttempts: 2,
        retryDelay: 1
      }
    };
    
    const monitor = new ChainKeywordMonitor(mockConfig);
    assert(monitor.instanceId === 'test_instance_123', 'Monitor created with correct instanceId');
    assert(monitor.chains.length === 2, 'Monitor has correct number of chains');
    assert(monitor.currentKeyword === 'TEST_COMPLETE', 'Monitor starts with first keyword');
    
    // Test 3: Keyword Detection Logic
    console.log('\n📋 Test 3: Keyword Detection Logic');
    
    // Mock some output scenarios
    const testOutputs = [
      {
        output: 'Some regular text without keywords',
        shouldDetect: false,
        description: 'Regular text'
      },
      {
        output: '> plz say TEST_COMPLETE',
        shouldDetect: false,
        description: 'User input with keyword'
      },
      {
        output: '⏺ Planning step: say TEST_COMPLETE',
        shouldDetect: false,
        description: 'Planning mention'
      },
      {
        output: '⏺ TEST_COMPLETE',
        shouldDetect: true,
        description: 'Valid completion signal'
      },
      {
        output: 'TEST_COMPLETE',
        shouldDetect: true,
        description: 'Standalone keyword'
      }
    ];
    
    for (const test of testOutputs) {
      monitor.outputBuffer = test.output;
      const detected = await monitor.detectKeywordInOutput('TEST_COMPLETE');
      assert(detected === test.shouldDetect, `Keyword detection: ${test.description} - Expected: ${test.shouldDetect}, Got: ${detected}`);
    }
    
    // Test 4: Status Reporting
    console.log('\n📋 Test 4: Status Reporting');
    const status = monitor.getStatus();
    assert(typeof status === 'object', 'Status returns object');
    assert(status.hasOwnProperty('isActive'), 'Status includes isActive');
    assert(status.hasOwnProperty('currentKeyword'), 'Status includes currentKeyword');
    assert(status.totalChains === 2, 'Status reports correct total chains');
    
    // Test 5: Event System
    console.log('\n📋 Test 5: Event System');
    let eventFired = false;
    monitor.on('started', () => {
      eventFired = true;
    });
    
    // Simulate start (but don't actually start polling to avoid real MCP calls)
    monitor.emit('started');
    assert(eventFired, 'Event system works correctly');
    
    // Test 6: Chain Configuration Validation
    console.log('\n📋 Test 6: Chain Configuration Validation');
    
    // Test invalid configs
    try {
      new ChainKeywordMonitor({ chains: [] }); // Missing instanceId
      assert(false, 'Should reject config without instanceId');
    } catch (error) {
      assert(error.message.includes('instanceId'), 'Rejects config without instanceId');
    }
    
    try {
      new ChainKeywordMonitor({ instanceId: 'test' }); // Missing chains
      assert(false, 'Should reject config without chains');
    } catch (error) {
      assert(error.message.includes('chains'), 'Rejects config without chains');
    }
    
    // Test 7: Keyword Mapping
    console.log('\n📋 Test 7: Keyword Mapping');
    assert(monitor.keywordMap.has('TEST_COMPLETE'), 'Keyword map contains first keyword');
    assert(monitor.keywordMap.has('FINAL_COMPLETE'), 'Keyword map contains second keyword');
    
    const firstChain = monitor.keywordMap.get('TEST_COMPLETE');
    assert(firstChain.instruction === 'Great! Now do the next step.', 'Keyword map has correct instruction');
    
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 TEST RESULTS: ${passCount}/${testCount} tests passed`);
    
    if (passCount === testCount) {
      console.log('🎉 ALL TESTS PASSED!');
      console.log('✅ Chain Keyword Monitor is working correctly');
      console.log('\n📚 Usage Instructions:');
      console.log('1. Edit example_chain_config.json with your instance ID');
      console.log('2. Define your keyword → instruction chains');
      console.log('3. Run: node chain_keyword_monitor.js example_chain_config.json');
      console.log('4. The monitor will automatically advance through stages');
      return true;
    } else {
      console.log(`❌ ${testCount - passCount} tests failed`);
      return false;
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
    return false;
  }
}

// Test the actual config file example
async function testConfigFile() {
  console.log('\n📖 Testing Example Config File...');
  
  try {
    const config = await loadConfig('./example_chain_config.json');
    console.log('✅ Example config loads successfully');
    console.log(`📋 Instance ID: ${config.instanceId}`);
    console.log(`🔗 Chains: ${config.chains.length}`);
    
    config.chains.forEach((chain, i) => {
      console.log(`  ${i + 1}. ${chain.keyword} → "${chain.instruction.substring(0, 50)}..."`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Config file test failed:', error.message);
    return false;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 CHAIN KEYWORD MONITOR TEST SUITE');
  console.log('=====================================\n');
  
  Promise.all([
    testChainMonitor(),
    testConfigFile()
  ]).then(([monitorTest, configTest]) => {
    console.log('\n' + '='.repeat(60));
    if (monitorTest && configTest) {
      console.log('🎊 ALL TESTS SUCCESSFUL - Ready to use!');
      process.exit(0);
    } else {
      console.log('💥 Some tests failed');
      process.exit(1);
    }
  }).catch(error => {
    console.error('💥 Test suite crashed:', error);
    process.exit(1);
  });
}

export { testChainMonitor };