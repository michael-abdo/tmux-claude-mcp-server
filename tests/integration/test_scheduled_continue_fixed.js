#!/usr/bin/env node

/**
 * Integration test for scheduled_continue.js
 */

import { spawn } from 'child_process';
import assert from 'assert';

console.log('🧪 Testing Scheduled Continue Integration...\n');

// Helper to run scheduled_continue with timeout
function runScheduledContinue(args, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const output = [];
    const errors = [];
    
    // Parse arguments properly to handle quoted strings
    const argArray = [];
    if (typeof args === 'string') {
      // Simple argument parsing that preserves quoted strings
      const matches = args.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      matches.forEach(arg => {
        // Remove surrounding quotes if present
        argArray.push(arg.replace(/^"(.*)"$/, '$1'));
      });
    } else {
      argArray.push(...args);
    }
    
    const proc = spawn('node', ['scripts/scheduled_continue.js', ...argArray]);
    
    const timeout = setTimeout(() => {
      proc.kill('SIGINT');
    }, timeoutMs);
    
    proc.stdout.on('data', (data) => {
      output.push(data.toString());
    });
    
    proc.stderr.on('data', (data) => {
      errors.push(data.toString());
    });
    
    proc.on('close', (code, signal) => {
      clearTimeout(timeout);
      resolve({
        code,
        signal,
        output: output.join(''),
        error: errors.join('')
      });
    });
    
    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        code: -1,
        signal: null,
        output: output.join(''),
        error: err.message
      });
    });
  });
}

async function runAllTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: Dry run completes successfully
  console.log('📋 Test 1: Dry run completes successfully');
  try {
    const result = await runScheduledContinue('+5m --dry-run');
    assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
    assert(result.output.includes('DRY RUN MODE'), 'Should show dry run mode');
    assert(result.output.includes('Dry run completed'), 'Should complete dry run');
    console.log('  ✅ Dry run test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Dry run test failed: ${e.message}\n`);
    failed++;
  }

  // Test 2: Help flag works
  console.log('📋 Test 2: Help flag displays help');
  try {
    const result = await runScheduledContinue('--help');
    assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
    assert(result.output.includes('USAGE:'), 'Should show usage');
    assert(result.output.includes('TIME FORMATS:'), 'Should show time formats');
    console.log('  ✅ Help flag test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Help flag test failed: ${e.message}\n`);
    failed++;
  }

  // Test 3: Version flag works
  console.log('📋 Test 3: Version flag displays version');
  try {
    const result = await runScheduledContinue('--version');
    assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
    assert(result.output.includes('scheduled_continue v'), 'Should show version');
    console.log('  ✅ Version flag test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Version flag test failed: ${e.message}\n`);
    failed++;
  }

  // Test 4: Invalid time format errors
  console.log('📋 Test 4: Invalid time format shows error');
  try {
    const result = await runScheduledContinue('invalid-time');
    assert(result.code === 2, `Expected exit code 2, got ${result.code}`);
    assert(result.error.includes('Error:'), 'Should show error');
    assert(result.error.includes('Valid formats:'), 'Should show valid formats');
    console.log('  ✅ Invalid time error test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Invalid time error test failed: ${e.message}\n`);
    failed++;
  }

  // Test 5: Missing time argument errors
  console.log('📋 Test 5: Missing time argument shows error');
  try {
    const result = await runScheduledContinue('');
    assert(result.code === 1, `Expected exit code 1, got ${result.code}`);
    assert(result.error.includes('Time argument required'), 'Should show missing argument error');
    console.log('  ✅ Missing argument error test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Missing argument error test failed: ${e.message}\n`);
    failed++;
  }

  // Test 6: Signal handling (SIGINT)
  console.log('📋 Test 6: SIGINT cancels execution gracefully');
  try {
    const result = await runScheduledContinue('+5m', 2000); // Kill after 2 seconds
    // Process might exit with code 0 after handling SIGINT gracefully
    assert(result.code === 0 || result.signal === 'SIGINT', 
      `Expected exit code 0 or SIGINT signal, got code=${result.code}, signal=${result.signal}`);
    assert(result.output.includes('Cancelling scheduled execution'), 'Should show cancellation message');
    assert(result.output.includes('Scheduled execution cancelled'), 'Should confirm cancellation');
    console.log('  ✅ Signal handling test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Signal handling test failed: ${e.message}\n`);
    failed++;
  }

  // Test 7: Custom message flag
  console.log('📋 Test 7: Custom message flag works');
  try {
    const result = await runScheduledContinue('+5m -m "Custom test message" --dry-run');
    assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
    assert(result.output.includes('Message to send: "Custom test message"'), 'Should use custom message');
    console.log('  ✅ Custom message test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Custom message test failed: ${e.message}\n`);
    failed++;
  }

  // Test 8: Verbose flag shows detailed output
  console.log('📋 Test 8: Verbose flag shows detailed output');
  try {
    const result = await runScheduledContinue('+5m --dry-run --verbose');
    assert(result.code === 0, `Expected exit code 0, got ${result.code}`);
    assert(result.output.includes('Discovering tmux sessions...'), 'Should show verbose discovery');
    console.log('  ✅ Verbose flag test passed\n');
    passed++;
  } catch (e) {
    console.log(`  ❌ Verbose flag test failed: ${e.message}\n`);
    failed++;
  }

  // Summary
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log('✅ All integration tests passed!');
  } else {
    console.log('❌ Some tests failed!');
    process.exit(1);
  }
}

// Run all tests
runAllTests();