#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projects = [
  '021929944919006658321',
  '021930015005142799484', 
  '021930257392096132881',
  '021930287495333139580',
  '021929947185876948092',
  '021929016736789551311'
];

async function spawnProjectExecutive(projectId) {
  const projectDir = `/Users/Mike/Desktop/programming/2_proposals/upwork/${projectId}`;
  
  console.log(`Spawning executive for project ${projectId}...`);
  
  const args = [
    path.join(__dirname, 'api/spawn_project_executive.js'),
    '--project-dir', projectDir,
    '--project-type', 'web-app',
    '--requirements-file', 'instructions.md',
    '--skip-login'
  ];
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', args, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function main() {
  for (const projectId of projects) {
    try {
      await spawnProjectExecutive(projectId);
      console.log(`✓ Successfully spawned executive for ${projectId}`);
    } catch (error) {
      console.error(`✗ Failed to spawn executive for ${projectId}:`, error.message);
    }
  }
}

main().catch(console.error);