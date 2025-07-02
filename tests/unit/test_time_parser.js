#!/usr/bin/env node

/**
 * Unit tests for time parser
 */

import { parseTimeInput, formatDelay, validateTimeBounds } from '../../scripts/utils/time_parser.js';
import assert from 'assert';

console.log('🧪 Testing Time Parser...\n');

// Test relative time formats
console.log('📋 Testing relative time formats:');

const relativeTests = [
  { input: '+5m', expectedMinutes: 5, description: '5 minutes' },
  { input: '+30m', expectedMinutes: 30, description: '30 minutes' },
  { input: '+90m', expectedMinutes: 90, description: '90 minutes' },
  { input: '+1h', expectedMinutes: 60, description: '1 hour' },
  { input: '+2h', expectedMinutes: 120, description: '2 hours' },
  { input: '+24h', expectedMinutes: 1440, description: '24 hours' },
];

relativeTests.forEach(test => {
  const result = parseTimeInput(test.input);
  assert(result.success, `Failed to parse ${test.input}`);
  const expectedMs = test.expectedMinutes * 60 * 1000;
  const tolerance = 1000; // 1 second tolerance
  assert(Math.abs(result.delayMs - expectedMs) < tolerance, 
    `Delay mismatch for ${test.input}: expected ~${expectedMs}ms, got ${result.delayMs}ms`);
  console.log(`  ✅ ${test.input} → ${test.description}`);
});

// Test invalid relative formats
console.log('\n📋 Testing invalid relative formats:');

const invalidRelativeTests = [
  { input: '+0m', reason: 'Zero minutes not allowed' },
  { input: '+25h', reason: 'More than 24 hours not allowed' },
  { input: '+1441m', reason: 'More than 1440 minutes not allowed' },
  { input: '30m', reason: 'Missing plus sign' },
  { input: '+30', reason: 'Missing unit' },
];

invalidRelativeTests.forEach(test => {
  const result = parseTimeInput(test.input);
  assert(!result.success, `Should have failed to parse ${test.input}`);
  console.log(`  ✅ ${test.input} → Correctly rejected (${test.reason})`);
});

// Test 12-hour formats
console.log('\n📋 Testing 12-hour formats:');

const twelveHourTests = [
  { input: '9:30am', description: '9:30 AM' },
  { input: '3:30pm', description: '3:30 PM' },
  { input: '12:00pm', description: '12:00 PM (noon)' },
  { input: '12:00am', description: '12:00 AM (midnight)' },
  { input: '11:59PM', description: '11:59 PM (case insensitive)' },
];

twelveHourTests.forEach(test => {
  const result = parseTimeInput(test.input);
  assert(result.success, `Failed to parse ${test.input}`);
  assert(result.parsedAs === '12-hour', `Wrong parse type for ${test.input}`);
  console.log(`  ✅ ${test.input} → ${test.description}`);
});

// Test natural language
console.log('\n📋 Testing natural language formats:');

const naturalTests = [
  { input: 'in 5 minutes', expectedMinutes: 5 },
  { input: 'in 30 minutes', expectedMinutes: 30 },
  { input: 'in 1 hour', expectedMinutes: 60 },
  { input: 'in 2 hours', expectedMinutes: 120 },
];

naturalTests.forEach(test => {
  const result = parseTimeInput(test.input);
  assert(result.success, `Failed to parse "${test.input}"`);
  const expectedMs = test.expectedMinutes * 60 * 1000;
  const tolerance = 1000;
  assert(Math.abs(result.delayMs - expectedMs) < tolerance,
    `Delay mismatch for "${test.input}"`);
  console.log(`  ✅ "${test.input}" → ${test.expectedMinutes} minutes`);
});

// Test formatDelay function
console.log('\n📋 Testing formatDelay function:');

const formatTests = [
  { ms: 60000, expected: '1 minute' },
  { ms: 120000, expected: '2 minutes' },
  { ms: 3600000, expected: '1 hour' },
  { ms: 7200000, expected: '2 hours' },
  { ms: 5400000, expected: '1 hour, 30 minutes' },
  { ms: 3661000, expected: '1 hour, 1 minute' },
];

formatTests.forEach(test => {
  const formatted = formatDelay(test.ms);
  assert(formatted === test.expected, 
    `Format mismatch: expected "${test.expected}", got "${formatted}"`);
  console.log(`  ✅ ${test.ms}ms → "${formatted}"`);
});

// Test validateTimeBounds
console.log('\n📋 Testing validateTimeBounds:');

const boundsTests = [
  { ms: 30000, valid: false, reason: 'Less than 1 minute' },
  { ms: 60000, valid: true, reason: 'Exactly 1 minute' },
  { ms: 3600000, valid: true, reason: '1 hour' },
  { ms: 86400000, valid: true, reason: 'Exactly 24 hours' },
  { ms: 86400001, valid: false, reason: 'More than 24 hours' },
];

boundsTests.forEach(test => {
  const result = validateTimeBounds(test.ms);
  assert(result.valid === test.valid,
    `Bounds check failed for ${test.ms}ms: expected valid=${test.valid}`);
  console.log(`  ✅ ${test.ms}ms → ${test.valid ? 'Valid' : 'Invalid'} (${test.reason})`);
});

console.log('\n✅ All time parser tests passed!');