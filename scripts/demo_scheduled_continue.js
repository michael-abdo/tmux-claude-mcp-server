#!/usr/bin/env node

/**
 * Demo script for scheduled_continue functionality
 */

import { spawn } from 'child_process';

console.log('🎯 Scheduled Continue Demo\n');
console.log('This demo will show various features of the scheduled continue script.\n');

// Helper to run a demo command
async function runDemo(description, command) {
  console.log(`📋 ${description}`);
  console.log(`   Command: ${command}`);
  console.log('   Output:');
  
  return new Promise((resolve) => {
    const proc = spawn('node', command.split(' '), { shell: true });
    
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.log(`   │ ${line}`);
      });
    });
    
    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) console.log(`   │ ❌ ${line}`);
      });
    });
    
    proc.on('close', () => {
      console.log('   └─────────────────────────────\n');
      resolve();
    });
  });
}

async function main() {
  // Demo 1: Show help
  await runDemo(
    'Demo 1: Display help information',
    'scripts/scheduled_continue.js --help'
  );

  // Demo 2: Relative time format
  await runDemo(
    'Demo 2: Schedule in 30 minutes (dry run)',
    'scripts/scheduled_continue.js +30m --dry-run'
  );

  // Demo 3: 12-hour format
  await runDemo(
    'Demo 3: Schedule at 3:30 PM (dry run)',
    'scripts/scheduled_continue.js 3:30pm --dry-run'
  );

  // Demo 4: Natural language
  await runDemo(
    'Demo 4: Schedule "in 2 hours" (dry run)',
    'scripts/scheduled_continue.js "in 2 hours" --dry-run'
  );

  // Demo 5: Custom message
  await runDemo(
    'Demo 5: Custom message "Time for code review" (dry run)',
    'scripts/scheduled_continue.js +1h -m "Time for code review" --dry-run'
  );

  // Demo 6: Verbose mode
  console.log('📋 Demo 6: Verbose mode (first 30 lines)');
  console.log('   Command: scripts/scheduled_continue.js +5m --dry-run --verbose');
  console.log('   Output:');
  
  const proc = spawn('node', ['scripts/scheduled_continue.js', '+5m', '--dry-run', '--verbose']);
  let lineCount = 0;
  
  await new Promise((resolve) => {
    proc.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim() && lineCount < 30) {
          console.log(`   │ ${line}`);
          lineCount++;
        }
      });
    });
    
    proc.on('close', () => {
      console.log('   │ ... (output truncated)');
      console.log('   └─────────────────────────────\n');
      resolve();
    });
  });

  // Demo 7: Error handling
  await runDemo(
    'Demo 7: Invalid time format error',
    'scripts/scheduled_continue.js invalid-time'
  );

  // Demo 8: Ambiguous time error
  await runDemo(
    'Demo 8: Ambiguous time error (2:30 without AM/PM)',
    'scripts/scheduled_continue.js 2:30'
  );

  console.log('✅ Demo completed!\n');
  console.log('📚 Key Features Demonstrated:');
  console.log('   • Multiple time format support (relative, 12-hour, 24-hour, natural language)');
  console.log('   • Custom message capability');
  console.log('   • Dry-run mode for testing');
  console.log('   • Verbose output for debugging');
  console.log('   • Comprehensive error handling\n');
  
  console.log('💡 To actually schedule a message (not dry-run):');
  console.log('   node scripts/scheduled_continue.js +30m');
  console.log('   (Keep the process running until execution time)');
}

main();