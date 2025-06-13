#!/usr/bin/env node

/**
 * VM Manager - Cloud instance lifecycle management for Claude Code environments
 * 
 * Extends the existing instance management patterns to support cloud VMs
 * Integrates with AWS EC2 for development environment provisioning
 */

import { spawn } from 'child_process';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * VM Instance Manager - Manages cloud instances for Claude development
 */
export class VMManager {
  constructor(options = {}) {
    this.provider = options.provider || 'aws';
    this.region = options.region || 'us-east-1';
    this.defaultInstanceType = options.instanceType || 'm5.xlarge';
    this.keyName = options.keyName || 'claude-dev-key';
    this.securityGroup = options.securityGroup || 'claude-dev-sg';
    this.stateFile = options.stateFile || join(__dirname, 'vm-state.json');
    this.setupScriptPath = join(__dirname, 'setup-scripts', 'claude-dev-setup.sh');
    
    // Load existing state
    this.state = { instances: {}, templates: {} };
    this.loadState();
  }

  /**
   * Load VM state from disk
   */
  async loadState() {
    try {
      const data = await readFile(this.stateFile, 'utf8');
      this.state = JSON.parse(data);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Warning: Could not load VM state: ${error.message}`);
      }
      // Initialize with default state
      this.state = { instances: {}, templates: {} };
    }
  }

  /**
   * Save VM state to disk
   */
  async saveState() {
    try {
      await mkdir(dirname(this.stateFile), { recursive: true });
      await writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      console.error(`Error saving VM state: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute AWS CLI command
   */
  async executeAWS(command) {
    return new Promise((resolve, reject) => {
      const child = spawn('aws', command, { shell: true });
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse as JSON, fall back to raw text
            const result = stdout.trim();
            if (result.startsWith('{') || result.startsWith('[')) {
              resolve(JSON.parse(result));
            } else {
              resolve(result);
            }
          } catch (error) {
            resolve(stdout.trim());
          }
        } else {
          reject(new Error(`AWS CLI failed (code ${code}): ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to execute AWS CLI: ${error.message}`));
      });
    });
  }

  /**
   * Create a new VM instance
   */
  async createInstance(name, options = {}) {
    const instanceConfig = {
      imageId: options.imageId || 'ami-0c02fb55956c7d316', // Ubuntu 20.04 LTS
      instanceType: options.instanceType || this.defaultInstanceType,
      keyName: options.keyName || this.keyName,
      securityGroups: options.securityGroups || [this.securityGroup],
      userData: options.userData || await this.getDefaultUserData(),
      spot: options.spot || false,
      maxPrice: options.maxPrice || '0.10'
    };

    console.log(`🚀 Creating VM instance: ${name}`);
    console.log(`   Instance Type: ${instanceConfig.instanceType}`);
    console.log(`   Region: ${this.region}`);
    console.log(`   Spot Instance: ${instanceConfig.spot ? 'Yes' : 'No'}`);

    try {
      const command = this.buildRunInstancesCommand(instanceConfig, name);
      const result = await this.executeAWS(command);
      
      const instanceId = result.Instances[0].InstanceId;
      const instance = {
        instanceId,
        name,
        status: 'pending',
        created: new Date().toISOString(),
        config: instanceConfig,
        publicIp: null,
        privateIp: result.Instances[0].PrivateIpAddress
      };

      this.state.instances[instanceId] = instance;
      await this.saveState();

      console.log(`✅ VM instance created: ${instanceId}`);
      console.log(`   Waiting for instance to start...`);

      // Wait for instance to be running
      await this.waitForInstanceState(instanceId, 'running');
      await this.updateInstanceInfo(instanceId);

      return instance;
    } catch (error) {
      console.error(`❌ Failed to create VM instance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build AWS run-instances command
   */
  buildRunInstancesCommand(config, name) {
    let command = [
      'ec2', 'run-instances',
      '--image-id', config.imageId,
      '--instance-type', config.instanceType,
      '--key-name', config.keyName,
      '--security-groups', config.securityGroups.join(' '),
      '--user-data', `file://${this.setupScriptPath}`,
      '--tag-specifications', `ResourceType=instance,Tags=[{Key=Name,Value=${name}},{Key=Project,Value=claude-dev}]`,
      '--region', this.region
    ];

    if (config.spot) {
      command.push(
        '--instance-market-options',
        `{\"MarketType\":\"spot\",\"SpotOptions\":{\"MaxPrice\":\"${config.maxPrice}\"}}`
      );
    }

    return command;
  }

  /**
   * Get default user data script
   */
  async getDefaultUserData() {
    try {
      return await readFile(this.setupScriptPath, 'utf8');
    } catch (error) {
      console.warn(`Warning: Could not read setup script: ${error.message}`);
      return this.getMinimalUserData();
    }
  }

  /**
   * Get minimal user data if setup script not found
   */
  getMinimalUserData() {
    return `#!/bin/bash
apt-get update -y
apt-get install -y git curl build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs
echo "Basic VM setup complete"`;
  }

  /**
   * Wait for instance to reach desired state
   */
  async waitForInstanceState(instanceId, desiredState, maxWaitTime = 300000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const result = await this.executeAWS([
          'ec2', 'describe-instances',
          '--instance-ids', instanceId,
          '--region', this.region
        ]);

        const instance = result.Reservations[0]?.Instances[0];
        if (instance && instance.State.Name === desiredState) {
          console.log(`✅ Instance ${instanceId} is now ${desiredState}`);
          return instance;
        }

        console.log(`⏳ Instance ${instanceId} is ${instance?.State.Name || 'unknown'}, waiting for ${desiredState}...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      } catch (error) {
        console.warn(`Warning: Error checking instance state: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
      }
    }

    throw new Error(`Instance ${instanceId} did not reach ${desiredState} state within ${maxWaitTime}ms`);
  }

  /**
   * Update instance information from AWS
   */
  async updateInstanceInfo(instanceId) {
    try {
      const result = await this.executeAWS([
        'ec2', 'describe-instances',
        '--instance-ids', instanceId,
        '--region', this.region
      ]);

      const awsInstance = result.Reservations[0]?.Instances[0];
      if (awsInstance && this.state.instances[instanceId]) {
        this.state.instances[instanceId].status = awsInstance.State.Name;
        this.state.instances[instanceId].publicIp = awsInstance.PublicIpAddress;
        this.state.instances[instanceId].privateIp = awsInstance.PrivateIpAddress;
        this.state.instances[instanceId].updated = new Date().toISOString();
        
        await this.saveState();
        
        if (awsInstance.PublicIpAddress) {
          console.log(`📍 Instance ${instanceId} public IP: ${awsInstance.PublicIpAddress}`);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not update instance info: ${error.message}`);
    }
  }

  /**
   * List all managed VM instances
   */
  async listInstances(options = {}) {
    const { includeTerminated = false, name = null } = options;
    
    console.log('🔍 Listing VM instances...');
    
    // Update all instance states
    for (const instanceId in this.state.instances) {
      await this.updateInstanceInfo(instanceId);
    }

    const instances = Object.values(this.state.instances)
      .filter(instance => {
        if (!includeTerminated && instance.status === 'terminated') {
          return false;
        }
        if (name && instance.name !== name) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.created) - new Date(a.created));

    if (instances.length === 0) {
      console.log('📋 No VM instances found');
      return [];
    }

    console.log('\n📋 VM Instances:');
    console.log('─'.repeat(80));
    
    instances.forEach(instance => {
      const statusIcon = this.getStatusIcon(instance.status);
      const ageMinutes = Math.floor((Date.now() - new Date(instance.created)) / 60000);
      
      console.log(`${statusIcon} ${instance.name} (${instance.instanceId})`);
      console.log(`   Status: ${instance.status}`);
      console.log(`   Type: ${instance.config?.instanceType || 'unknown'}`);
      console.log(`   Public IP: ${instance.publicIp || 'pending'}`);
      console.log(`   Age: ${ageMinutes}m`);
      console.log('');
    });

    return instances;
  }

  /**
   * Get status icon for display
   */
  getStatusIcon(status) {
    const icons = {
      'pending': '🟡',
      'running': '🟢',
      'stopping': '🟠',
      'stopped': '🔴',
      'terminated': '⚫',
      'unknown': '❓'
    };
    return icons[status] || icons.unknown;
  }

  /**
   * Terminate a VM instance
   */
  async terminateInstance(identifier) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    console.log(`🗑️  Terminating VM instance: ${instanceId}`);
    
    try {
      await this.executeAWS([
        'ec2', 'terminate-instances',
        '--instance-ids', instanceId,
        '--region', this.region
      ]);

      if (this.state.instances[instanceId]) {
        this.state.instances[instanceId].status = 'terminated';
        this.state.instances[instanceId].terminated = new Date().toISOString();
        await this.saveState();
      }

      console.log(`✅ Instance ${instanceId} termination initiated`);
    } catch (error) {
      console.error(`❌ Failed to terminate instance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop a VM instance
   */
  async stopInstance(identifier) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    console.log(`⏸️  Stopping VM instance: ${instanceId}`);
    
    try {
      await this.executeAWS([
        'ec2', 'stop-instances',
        '--instance-ids', instanceId,
        '--region', this.region
      ]);

      console.log(`✅ Instance ${instanceId} stop initiated`);
      await this.waitForInstanceState(instanceId, 'stopped');
    } catch (error) {
      console.error(`❌ Failed to stop instance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Start a stopped VM instance
   */
  async startInstance(identifier) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    console.log(`▶️  Starting VM instance: ${instanceId}`);
    
    try {
      await this.executeAWS([
        'ec2', 'start-instances',
        '--instance-ids', instanceId,
        '--region', this.region
      ]);

      console.log(`✅ Instance ${instanceId} start initiated`);
      await this.waitForInstanceState(instanceId, 'running');
      await this.updateInstanceInfo(instanceId);
    } catch (error) {
      console.error(`❌ Failed to start instance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get SSH connection command
   */
  getSSHCommand(identifier, options = {}) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId || !this.state.instances[instanceId]) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    const instance = this.state.instances[instanceId];
    if (!instance.publicIp) {
      throw new Error(`Instance ${instanceId} does not have a public IP address`);
    }

    const keyPath = options.keyPath || `~/.ssh/${this.keyName}.pem`;
    const username = options.username || 'ubuntu';
    
    return `ssh -i ${keyPath} ${username}@${instance.publicIp}`;
  }

  /**
   * Resolve instance ID from name or ID
   */
  resolveInstanceId(identifier) {
    // If it's already an instance ID
    if (this.state.instances[identifier]) {
      return identifier;
    }
    
    // Look up by name
    for (const [instanceId, instance] of Object.entries(this.state.instances)) {
      if (instance.name === identifier) {
        return instanceId;
      }
    }
    
    return null;
  }

  /**
   * Create an AMI from an existing instance
   */
  async createImage(identifier, imageName, description = null) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    console.log(`📸 Creating AMI from instance: ${instanceId}`);
    
    try {
      const result = await this.executeAWS([
        'ec2', 'create-image',
        '--instance-id', instanceId,
        '--name', imageName,
        '--description', description || `AMI created from ${instanceId}`,
        '--region', this.region
      ]);

      const imageId = result.ImageId;
      
      this.state.templates[imageName] = {
        imageId,
        created: new Date().toISOString(),
        sourceInstance: instanceId,
        name: imageName,
        description
      };
      
      await this.saveState();
      
      console.log(`✅ AMI creation initiated: ${imageId}`);
      return imageId;
    } catch (error) {
      console.error(`❌ Failed to create AMI: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get instance health and resource usage
   */
  async getInstanceMetrics(identifier) {
    const instanceId = this.resolveInstanceId(identifier);
    if (!instanceId) {
      throw new Error(`Instance not found: ${identifier}`);
    }

    try {
      // Get basic instance info
      await this.updateInstanceInfo(instanceId);
      const instance = this.state.instances[instanceId];
      
      // Get CloudWatch metrics (if available)
      // This would require additional AWS CLI calls for CPU, memory, etc.
      
      return {
        instanceId,
        status: instance.status,
        uptime: instance.created ? Date.now() - new Date(instance.created) : 0,
        publicIp: instance.publicIp,
        privateIp: instance.privateIp,
        lastUpdated: instance.updated || instance.created
      };
    } catch (error) {
      console.warn(`Warning: Could not get metrics for ${instanceId}: ${error.message}`);
      return null;
    }
  }
}

export default VMManager;