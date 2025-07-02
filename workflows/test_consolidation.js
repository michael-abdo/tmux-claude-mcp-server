#!/usr/bin/env node
/**
 * Test suite to verify all consolidations work correctly
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

async function runCommand(command, args = []) {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { 
      stdio: 'pipe',
      shell: false 
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => stdout += data);
    proc.stderr.on('data', (data) => stderr += data);
    
    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function testConsolidation() {
  console.log('🧪 TESTING WORKFLOW CONSOLIDATION\n');
  
  const tests = [
    {
      name: 'Chain Keyword Monitor',
      command: 'node',
      args: ['chain_keyword_monitor.js'],
      expectInOutput: 'Usage: node chain_keyword_monitor.js'
    },
    {
      name: 'Debug Keyword Monitor',
      command: 'node',
      args: ['debug_keyword_monitor.js'],
      expectInOutput: 'Usage: node debug_keyword_monitor.js'
    },
    {
      name: 'Task Chain Launcher',
      command: 'node',
      args: ['task_chain_launcher.js'],
      expectInOutput: 'Usage: node task_chain_launcher.js'
    },
    {
      name: 'Quick Task',
      command: 'node',
      args: ['quick_task.js', '--help'],
      expectInOutput: 'QUICK TASK RUNNER'
    },
    {
      name: 'Test Chain Monitor',
      command: 'node',
      args: ['test_chain_monitor.js'],
      expectInOutput: 'ALL TESTS PASSED',
      expectCode: 0
    },
    {
      name: 'Shared Utils Import',
      command: 'node',
      args: ['-e', 'import("./shared/workflow_utils.js").then(m => console.log(Object.keys(m).join(", ")))'],
      expectInOutput: 'isActualCompletionSignal'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    process.stdout.write(`📋 ${test.name}... `);
    
    try {
      const result = await runCommand(test.command, test.args);
      const output = result.stdout + result.stderr;
      
      let success = true;
      
      if (test.expectInOutput && !output.includes(test.expectInOutput)) {
        success = false;
        console.log(`❌ Missing expected output: "${test.expectInOutput}"`);
      }
      
      if (test.expectCode !== undefined && result.code !== test.expectCode) {
        success = false;
        console.log(`❌ Wrong exit code: ${result.code} (expected ${test.expectCode})`);
      }
      
      if (success) {
        console.log('✅');
        passed++;
      } else {
        failed++;
        if (process.env.DEBUG) {
          console.log('Output:', output);
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`📊 RESULTS: ${passed}/${tests.length} tests passed`);
  
  if (failed === 0) {
    console.log('🎉 ALL CONSOLIDATIONS WORKING CORRECTLY!');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} tests failed`);
    process.exit(1);
  }
}

testConsolidation().catch(console.error);