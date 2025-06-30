#!/usr/bin/env node

/**
 * Simple Integration Test - Test core functionality without timeouts
 */

const { spawn } = require('child_process');

async function testSimpleIntegration() {
  console.log('🧪 Simple Integration Test');
  console.log('=' .repeat(50));
  console.log('');

  try {
    // Step 1: Test universal launcher works
    console.log('🚀 Step 1: Testing universal launcher from subdirectory...');
    
    const result = await new Promise((resolve, reject) => {
      const process = spawn('../../bin/workflow-start', ['--help'], {
        cwd: 'test-directories/project1',
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('Persistent Workflow Launcher')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      process.on('error', () => resolve(false));
    });

    if (result) {
      console.log('✅ Universal launcher works from subdirectory');
    } else {
      console.log('❌ Universal launcher failed');
    }

    // Step 2: Test direct runner works  
    console.log('🔧 Step 2: Testing direct workflow runner...');
    
    const runnerWorks = await new Promise((resolve, reject) => {
      const process = spawn('node', ['src/workflow/run_persistent_workflow.cjs', '--help'], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('Persistent Workflow Runner')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      process.on('error', () => resolve(false));
    });

    if (runnerWorks) {
      console.log('✅ Direct workflow runner works');
    } else {
      console.log('❌ Direct workflow runner failed');
    }

    // Step 3: Test MCP bridge works
    console.log('🔌 Step 3: Testing MCP bridge...');
    
    const bridgeWorks = await new Promise((resolve) => {
      const process = spawn('node', ['scripts/mcp_bridge.js', 'list', '{}'], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('success')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      process.on('error', () => resolve(false));
    });

    if (bridgeWorks) {
      console.log('✅ MCP bridge works');
    } else {
      console.log('❌ MCP bridge failed');
    }

    // Step 4: Test auto-attach component
    console.log('🔗 Step 4: Testing auto-attach component...');
    
    const autoAttachWorks = await new Promise((resolve) => {
      const process = spawn('node', ['-e', `
        const AutoAttach = require('./src/workflow/auto_attach.cjs');
        const autoAttach = new AutoAttach();
        console.log('Auto-attach component loaded successfully');
      `], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('loaded successfully')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      process.on('error', () => resolve(false));
    });

    if (autoAttachWorks) {
      console.log('✅ Auto-attach component works');
    } else {
      console.log('❌ Auto-attach component failed');
    }

    // Step 5: Test workflow YAML exists
    console.log('📄 Step 5: Testing workflow YAML...');
    
    const fs = require('fs');
    const yamlExists = fs.existsSync('workflows/core/persistent_execute_compare_commit.yaml');
    
    if (yamlExists) {
      console.log('✅ Workflow YAML exists');
    } else {
      console.log('❌ Workflow YAML missing');
    }

    // Summary
    console.log('');
    console.log('📊 SIMPLE INTEGRATION TEST RESULTS');
    console.log('='.repeat(50));

    const tests = [
      { name: 'Universal Launcher', passed: result },
      { name: 'Direct Workflow Runner', passed: runnerWorks },
      { name: 'MCP Bridge', passed: bridgeWorks },
      { name: 'Auto-Attach Component', passed: autoAttachWorks },
      { name: 'Workflow YAML', passed: yamlExists }
    ];

    tests.forEach(test => {
      const status = test.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
    });

    const passedCount = tests.filter(t => t.passed).length;
    const totalCount = tests.length;

    console.log('');
    console.log(`📈 RESULTS: ${passedCount}/${totalCount} components working`);

    if (passedCount === totalCount) {
      console.log('🎉 ALL COMPONENTS READY - System should work end-to-end!');
      console.log('');
      console.log('🚀 Ready to use:');
      console.log('   From any directory: ./bin/workflow-start --auto-attach');
      console.log('   Direct: node src/workflow/run_persistent_workflow.cjs --auto-attach');
    } else {
      console.log('⚠️  Some components need fixes before end-to-end testing');
    }

    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

testSimpleIntegration();