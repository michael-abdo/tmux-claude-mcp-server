#!/usr/bin/env node

/**
 * Integration test for scheduled_continue.js
 */

import { spawn } from 'child_process';
import { execSync } from 'child_process';
import assert from 'assert';

console.log('🧪 Testing Scheduled Continue Integration...\n');

// Helper to run scheduled_continue with timeout
function runScheduledContinue(args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const output = [];
    const errors = [];
    
    const proc = spawn('node', ['scripts/scheduled_continue.js', ...args.split(' ')]);
    
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
  });
}

// Test 1: Dry run completes successfully
console.log('📋 Test 1: Dry run completes successfully');
(async () => {
  const result = await runScheduledContinue('+5m --dry-run');
  assert(result.code === 0, 'Dry run should exit with code 0');
  assert(result.output.includes('DRY RUN MODE'), 'Should show dry run mode');
  assert(result.output.includes('Dry run completed'), 'Should complete dry run');
  console.log('  ✅ Dry run test passed\n');
})();

// Test 2: Help flag works
console.log('📋 Test 2: Help flag displays help');
(async () => {
  const result = await runScheduledContinue('--help');
  assert(result.code === 0, 'Help should exit with code 0');
  assert(result.output.includes('USAGE:'), 'Should show usage');
  assert(result.output.includes('TIME FORMATS:'), 'Should show time formats');
  console.log('  ✅ Help flag test passed\n');
})();

// Test 3: Version flag works
console.log('📋 Test 3: Version flag displays version');
(async () => {
  const result = await runScheduledContinue('--version');
  assert(result.code === 0, 'Version should exit with code 0');
  assert(result.output.includes('scheduled_continue v'), 'Should show version');
  console.log('  ✅ Version flag test passed\n');
})();

// Test 4: Invalid time format errors
console.log('📋 Test 4: Invalid time format shows error');
(async () => {
  const result = await runScheduledContinue('invalid-time');
  assert(result.code === 2, 'Invalid time should exit with code 2');
  assert(result.error.includes('Error:'), 'Should show error');
  assert(result.error.includes('Valid formats:'), 'Should show valid formats');
  console.log('  ✅ Invalid time error test passed\n');
})();

// Test 5: Missing time argument errors
console.log('📋 Test 5: Missing time argument shows error');
(async () => {
  const result = await runScheduledContinue('');
  assert(result.code === 1, 'Missing argument should exit with code 1');
  assert(result.error.includes('Time argument required'), 'Should show missing argument error');
  console.log('  ✅ Missing argument error test passed\n');
})();

// Test 6: Signal handling (SIGINT)
console.log('📋 Test 6: SIGINT cancels execution gracefully');
(async () => {
  const result = await runScheduledContinue('+5m', 2000); // Kill after 2 seconds
  assert(result.signal === 'SIGINT', 'Should be killed by SIGINT');
  assert(result.output.includes('Cancelling scheduled execution'), 'Should show cancellation message');
  assert(result.output.includes('Scheduled execution cancelled'), 'Should confirm cancellation');
  console.log('  ✅ Signal handling test passed\n');
})();

// Test 7: Custom message flag
console.log('📋 Test 7: Custom message flag works');
(async () => {
  const result = await runScheduledContinue('+5m -m "Custom test message" --dry-run');
  assert(result.code === 0, 'Should exit with code 0');
  assert(result.output.includes('Message to send: "Custom test message"'), 'Should use custom message');
  console.log('  ✅ Custom message test passed\n');
})();

// Test 8: Verbose flag shows detailed output
console.log('📋 Test 8: Verbose flag shows detailed output');
(async () => {
  const result = await runScheduledContinue('+5m --dry-run --verbose');
  assert(result.code === 0, 'Should exit with code 0');
  assert(result.output.includes('Discovering tmux sessions...'), 'Should show verbose discovery');
  assert(result.output.match(/claude_exec_\d+/g), 'Should list session names');
  console.log('  ✅ Verbose flag test passed\n');
})();

console.log('✅ All integration tests passed!');