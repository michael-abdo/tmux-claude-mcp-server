#!/usr/bin/env node

/**
 * Test runner for scheduled continue feature
 */

import { spawn } from 'child_process';

console.log('🧪 Running All Scheduled Continue Tests\n');

const tests = [
  {
    name: 'Unit Tests - Time Parser',
    file: 'tests/unit/test_time_parser.js'
  },
  {
    name: 'Integration Tests - CLI',
    file: 'tests/integration/test_scheduled_continue_fixed.js'
  }
];

let totalPassed = 0;
let totalFailed = 0;

async function runTest(test) {
  console.log(`\n📋 Running: ${test.name}`);
  console.log('━'.repeat(50));
  
  return new Promise((resolve) => {
    const proc = spawn('node', [test.file], { stdio: 'inherit' });
    
    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${test.name}: PASSED`);
        totalPassed++;
      } else {
        console.log(`\n❌ ${test.name}: FAILED (exit code ${code})`);
        totalFailed++;
      }
      resolve();
    });
  });
}

async function runAllTests() {
  for (const test of tests) {
    await runTest(test);
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 FINAL RESULTS');
  console.log('═'.repeat(50));
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`📋 Total:  ${totalPassed + totalFailed}`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed!');
    process.exit(1);
  }
}

runAllTests();