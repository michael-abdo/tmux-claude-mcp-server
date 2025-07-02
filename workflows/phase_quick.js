#!/usr/bin/env node
/**
 * Phase Implementation Quick Runner
 * 
 * Usage: 
 *   node phase_quick.js
 *   node phase_quick.js --instance spec_1_1_123456
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  let instanceId = null;
  
  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--instance' || args[i] === '-i') && args[i + 1]) {
      instanceId = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
🚀 PHASE IMPLEMENTATION RUNNER
==============================

Run the complete phase implementation workflow:
1. Execute Phase Implementation
2. Compare Requirements vs Implementation  
3. Eliminate Duplicated Functionality
4. Cleanup, Document, and Commit

USAGE:
  node phase_quick.js [options]

OPTIONS:
  --instance, -i <id>    Specify Claude instance ID (otherwise uses latest)
  --help, -h             Show this help message

EXAMPLE:
  node phase_quick.js
  node phase_quick.js --instance spec_1_1_123456

The workflow will automatically progress through all stages!
      `);
      process.exit(0);
    }
  }
  
  console.log('🚀 PHASE IMPLEMENTATION WORKFLOW');
  console.log('================================\n');
  console.log('📋 Workflow Stages:');
  console.log('  1. Execute Phase Implementation → EXECUTE_FINISHED');
  console.log('  2. Compare Requirements vs Implementation → COMPARISON FINISHED');
  console.log('  3. Eliminate Duplicated Functionality → DUPLICATION_ELIMINATED');
  console.log('  4. Cleanup, Document, and Commit → COMMIT_FINISHED');
  
  if (instanceId) {
    console.log(`\n🎯 Instance: ${instanceId}`);
  } else {
    console.log('\n🎯 Instance: Will use latest active instance');
  }
  
  console.log('\n🔗 Starting phase implementation workflow...\n');
  
  // Build the command
  const configPath = path.join(__dirname, 'phase_implementation_workflow.json');
  const launcherPath = path.join(__dirname, 'task_chain_launcher.js');
  const launcherArgs = [launcherPath, configPath];
  if (instanceId) {
    launcherArgs.push(instanceId);
  }
  
  // Run the task chain launcher
  const launcher = spawn('node', launcherArgs, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  // Handle exit
  launcher.on('exit', (code) => {
    if (code === 0) {
      console.log('\n✅ Phase implementation workflow completed successfully!');
    }
    process.exit(code || 0);
  });
  
  // Handle interrupts
  process.on('SIGINT', () => {
    launcher.kill('SIGINT');
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Error:', error.message);
    process.exit(1);
  });
}