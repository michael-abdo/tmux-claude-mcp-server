#!/usr/bin/env node

/**
 * DRY Configuration Loader for VM Manager
 * Loads configuration from vm-connection-config bash script
 */

import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load configuration from the bash config file
 */
export function loadVMConfig() {
  const configPath = join(__dirname, 'vm-connection-config');
  
  try {
    // Source the config and echo the variables
    const configScript = `
      source ${configPath}
      echo "VM_NAME=$VM_NAME"
      echo "PROJECT=$PROJECT"
      echo "ZONE=$ZONE"
      echo "VM_IP=$VM_IP"
      echo "ALIVE_INTERVAL=$ALIVE_INTERVAL"
      echo "ALIVE_COUNT=$ALIVE_COUNT"
      echo "CONNECT_TIMEOUT=$CONNECT_TIMEOUT"
      echo "CONNECT_ATTEMPTS=$CONNECT_ATTEMPTS"
    `;
    
    const output = execSync(configScript, { shell: '/bin/bash' }).toString();
    const config = {};
    
    // Parse the output
    output.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        config[match[1]] = match[2];
      }
    });
    
    return {
      vmName: config.VM_NAME,
      project: config.PROJECT,
      zone: config.ZONE,
      vmIP: config.VM_IP,
      sshOptions: {
        serverAliveInterval: parseInt(config.ALIVE_INTERVAL) || 15,
        serverAliveCountMax: parseInt(config.ALIVE_COUNT) || 12,
        connectTimeout: parseInt(config.CONNECT_TIMEOUT) || 10,
        connectionAttempts: parseInt(config.CONNECT_ATTEMPTS) || 5
      }
    };
  } catch (error) {
    console.error('Failed to load VM config:', error.message);
    return {
      // Fallback defaults
      vmName: 'claude-dev-1750040389',
      project: 'claude-code-dev-20250615-1851',
      zone: 'us-central1-a',
      vmIP: '35.209.236.51',
      sshOptions: {
        serverAliveInterval: 15,
        serverAliveCountMax: 12,
        connectTimeout: 10,
        connectionAttempts: 5
      }
    };
  }
}

// Export as default
export default loadVMConfig;