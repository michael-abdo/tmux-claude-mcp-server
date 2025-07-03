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
import { VMLogger, logStateChange, BatchLogger } from './utils/logger.js';

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
    
    // Initialize logging
    this.logger = new VMLogger('vm-manager');
    
    // Load existing state
    this.state = { instances: {}, templates: {} };
    this.loadState();
    
    this.logger.info('VM Manager initialized', null, {
      provider: this.provider,
      region: this.region,
      defaultInstanceType: this.defaultInstanceType,
      stateFile: this.stateFile
    });
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
    const operationId = this.logger.startOperation('vm_create', {
      vmName: name,
      region: this.region,
      requestedInstanceType: options.instanceType,
      spotRequested: options.spot || false
    });

    try {
      const instanceConfig = {
        imageId: options.imageId || 'ami-0c02fb55956c7d316', // Ubuntu 20.04 LTS
        instanceType: options.instanceType || this.defaultInstanceType,
        keyName: options.keyName || this.keyName,
        securityGroups: options.securityGroups || [this.securityGroup],
        userData: options.userData || await this.getDefaultUserData(),
        spot: options.spot || false,
        maxPrice: options.maxPrice || '0.10'
      };

      this.logger.info('Starting VM instance creation', operationId, {
        vmName: name,
        instanceType: instanceConfig.instanceType,
        region: this.region,
        spot: instanceConfig.spot,
        imageId: instanceConfig.imageId
      });

      // Log cost implications
      this.logger.logCostEvent('vm_creation_requested', operationId, {
        estimated: this.estimateInstanceCost(instanceConfig),
        instanceType: instanceConfig.instanceType,
        spot: instanceConfig.spot,
        region: this.region
      });

      // Log security-sensitive operations
      this.logger.logSecurityEvent('vm_creation_with_key', operationId, {
        keyName: instanceConfig.keyName,
        securityGroups: instanceConfig.securityGroups
      });

      const command = this.buildRunInstancesCommand(instanceConfig, name);
      this.logger.logAWSCommand(operationId, command, { region: this.region });
      
      const result = await this.executeAWS(command);
      this.logger.logAWSResponse(operationId, command, result, true);
      
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

      // Log state change
      const previousState = { ...this.state };
      this.state.instances[instanceId] = instance;
      logStateChange('vm_instances', previousState.instances, this.state.instances, operationId);
      
      await this.saveState();

      this.logger.info('VM instance created, waiting for startup', operationId, {
        instanceId,
        privateIp: instance.privateIp,
        status: 'pending'
      });

      // Wait for instance to be running
      await this.waitForInstanceState(instanceId, 'running', operationId);
      await this.updateInstanceInfo(instanceId, operationId);

      this.logger.completeOperation(operationId, {
        instanceId,
        publicIp: instance.publicIp,
        finalStatus: 'running'
      });

      return instance;
    } catch (error) {
      this.logger.failOperation(operationId, error, {
        vmName: name,
        region: this.region,
        provider: this.provider
      });
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
  async waitForInstanceState(instanceId, desiredState, operationId = null, maxWaitTime = 300000) {
    const startTime = Date.now();
    
    this.logger.info('Waiting for instance state transition', operationId, {
      instanceId,
      desiredState,
      maxWaitTime,
      currentTime: new Date().toISOString()
    });
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const command = [
          'ec2', 'describe-instances',
          '--instance-ids', instanceId,
          '--region', this.region
        ];
        
        this.logger.debug('Checking instance state', operationId, {
          instanceId,
          timeElapsed: Date.now() - startTime
        });
        
        const result = await this.executeAWS(command);
        const instance = result.Reservations[0]?.Instances[0];
        
        if (instance && instance.State.Name === desiredState) {
          this.logger.info('Instance state transition completed', operationId, {
            instanceId,
            finalState: desiredState,
            duration: Date.now() - startTime
          });
          return instance;
        }

        const currentState = instance?.State.Name || 'unknown';
        this.logger.debug('Instance state check', operationId, {
          instanceId,
          currentState,
          desiredState,
          timeElapsed: Date.now() - startTime
        });
        
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      } catch (error) {
        this.logger.warn('Error checking instance state', operationId, {
          instanceId,
          error: error.message,
          timeElapsed: Date.now() - startTime
        });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds on error
      }
    }

    const timeoutError = new Error(`Instance ${instanceId} did not reach ${desiredState} state within ${maxWaitTime}ms`);
    this.logger.error('Instance state transition timeout', operationId, {
      instanceId,
      desiredState,
      maxWaitTime,
      actualWaitTime: Date.now() - startTime
    });
    throw timeoutError;
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
   * Estimate instance cost (simplified calculation)
   */
  estimateInstanceCost(instanceConfig) {
    const hourlyRates = {
      't3.micro': 0.0104,
      't3.small': 0.0208,
      't3.medium': 0.0416,
      'm5.large': 0.096,
      'm5.xlarge': 0.192,
      'm5.2xlarge': 0.384
    };
    
    const baseRate = hourlyRates[instanceConfig.instanceType] || 0.1;
    const spotDiscount = instanceConfig.spot ? 0.7 : 1.0; // ~70% discount for spot
    
    return {
      hourly: baseRate * spotDiscount,
      daily: baseRate * spotDiscount * 24,
      monthly: baseRate * spotDiscount * 24 * 30
    };
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