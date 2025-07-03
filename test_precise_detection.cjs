#!/usr/bin/env node

/**
 * Test the improved keyword detection precision
 */

const KeywordMonitor = require('./src/workflow/keyword_monitor.cjs');

// Sample output that should NOT trigger detection (keyword in user message only)
const falsePositiveOutput = `
> Based on your execution and analysis, let's check what needs to be committed.

  Please run: git status

  Then analyze:
  - What files have been changed?
  - Are these changes ready to be committed?
  - What would be an appropriate commit message?

  When done with your git status analysis, please type: COMMIT_FINISHED

⏺ Bash(git status)
  ⎿  On branch specialist-spec_1_1_018229-SPECIFIC-assigned
     Untracked files:
       (use "git add <file>..." to include in what will be committed)
        .claude/

⏺ Git Status Analysis

  Files Changed:
  - test.txt - New untracked file containing "Hello World"

╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ >                                                                                                                     │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
`;

// Sample output that SHOULD trigger detection (keyword in Claude's response)
const truePositiveOutput = `
> Based on your execution and analysis, let's check what needs to be committed.

  Please run: git status

  Then analyze:
  - What files have been changed?
  - Are these changes ready to be committed?
  - What would be an appropriate commit message?

  When done with your git status analysis, please type: COMMIT_FINISHED

⏺ Bash(git status)
  ⎿  On branch specialist-spec_1_1_018229-SPECIFIC-assigned
     Untracked files:
       (use "git add <file>..." to include in what will be committed)
        .claude/

⏺ Git Status Analysis

  Files Changed:
  - test.txt - New untracked file containing "Hello World"
  
  COMMIT_FINISHED

╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ >                                                                                                                     │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
`;

function testDetection() {
  console.log('🧪 Testing Improved Keyword Detection Precision\n');
  
  const monitor = new KeywordMonitor({
    instanceId: 'test',
    keyword: 'COMMIT_FINISHED',
    pollInterval: 1,
    timeout: 1,
    simpleMode: true
  });
  
  // Test 1: Should NOT detect (keyword only in user message)
  monitor.outputBuffer = falsePositiveOutput;
  const falseResult = monitor.detectSimpleKeyword('COMMIT_FINISHED');
  console.log('Test 1 - Keyword in user message only:');
  console.log(`Expected: false, Got: ${falseResult} ${falseResult ? '❌' : '✅'}\n`);
  
  // Test 2: SHOULD detect (keyword in Claude's response)  
  monitor.outputBuffer = truePositiveOutput;
  const trueResult = monitor.detectSimpleKeyword('COMMIT_FINISHED');
  console.log('Test 2 - Keyword in Claude\'s response:');
  console.log(`Expected: true, Got: ${trueResult} ${trueResult ? '✅' : '❌'}\n`);
  
  // Test 3: Verify extraction works correctly
  const extracted = monitor.extractMostRecentClaudeResponse(truePositiveOutput);
  console.log('Test 3 - Extracted Claude response:');
  console.log('─'.repeat(50));
  console.log(extracted);
  console.log('─'.repeat(50));
  console.log(`Contains ⏺ markers: ${extracted.includes('⏺') ? '✅' : '❌'}`);
  console.log(`Contains COMMIT_FINISHED: ${extracted.includes('COMMIT_FINISHED') ? '✅' : '❌'}`);
  console.log(`Does NOT contain user prompt: ${!extracted.includes('When done with your git status analysis') ? '✅' : '❌'}\n`);
  
  // Summary
  const allTestsPassed = !falseResult && trueResult && extracted.includes('⏺') && extracted.includes('COMMIT_FINISHED');
  console.log(`🎯 Overall Result: ${allTestsPassed ? '✅ All tests passed!' : '❌ Some tests failed'}`);
  console.log('\nThe improved detection should now:');
  console.log('- ✅ Ignore keywords in user instructions');
  console.log('- ✅ Only detect keywords in Claude\'s actual responses');
  console.log('- ✅ Avoid false positives from the text input area');
}

testDetection();