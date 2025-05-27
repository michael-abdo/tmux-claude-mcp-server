#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function monitorE2ETest() {
  const manager = new InstanceManager(path.join(__dirname, '../state/instances.json'));
  
  const globalStateFile = path.join(__dirname, '../state/instances.json');
  const execStateFile = '/Users/Mike/.claude/user/tmux-claude-mcp-server/workdir/ecom_frontend/exec_257155/state/instances.json';
  
  console.log('\n=== E2E Test Monitor ===\n');
  
  // Monitor executive progress
  const execId = 'exec_257155';
  console.log('Executive Instance:', execId);
  
  // Get executive's managers
  try {
    const { default: fs } = await import('fs');
    const execState = JSON.parse(fs.readFileSync(execStateFile, 'utf8'));
    const managers = Object.values(execState.instances);
    
    console.log(`\nManagers spawned: ${managers.length}`);
    managers.forEach(m => {
      console.log(`  - ${m.instanceId}: ${m.status} (created: ${new Date(m.created).toLocaleTimeString()})`);
    });
    
    // Check for HTML files
    const workdir = '/Users/Mike/.claude/user/tmux-claude-mcp-server/workdir/ecom_frontend';
    console.log('\nChecking for HTML files...');
    
    const files = fs.readdirSync(workdir).filter(f => f.endsWith('.html'));
    if (files.length > 0) {
      console.log('HTML files found:');
      files.forEach(f => console.log(`  - ${f}`));
    } else {
      console.log('No HTML files created yet.');
    }
    
    // Check for any directories
    const dirs = fs.readdirSync(workdir).filter(f => {
      const stat = fs.statSync(path.join(workdir, f));
      return stat.isDirectory() && !f.startsWith('.');
    });
    
    console.log('\nDirectories in workdir:');
    dirs.forEach(d => console.log(`  - ${d}/`));
    
  } catch (error) {
    console.error('Error reading executive state:', error.message);
  }
  
  console.log('\n---\nMonitoring will update every 30 seconds...\n');
}

// Run monitor every 30 seconds
monitorE2ETest();
setInterval(monitorE2ETest, 30000);