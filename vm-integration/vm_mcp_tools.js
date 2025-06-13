/**
 * VM MCP Tools - Model Context Protocol tools for VM management
 * 
 * Integrates VM management capabilities with the existing MCP orchestration system
 * Allows Claude instances to manage development VMs programmatically
 */

import { VMManager } from './vm_manager.js';

/**
 * VM MCP Tools implementation
 */
export class VMMCPTools {
  constructor(options = {}) {
    this.vmManager = new VMManager(options);
    this.tools = this.buildToolDefinitions();
  }

  /**
   * Build MCP tool definitions for VM management
   */
  buildToolDefinitions() {
    return {
      vm_create: {
        name: 'vm_create',
        description: 'Create a new VM instance for Claude development',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for the VM instance'
            },
            instanceType: {
              type: 'string',
              description: 'AWS instance type (default: m5.xlarge)',
              default: 'm5.xlarge'
            },
            spot: {
              type: 'boolean',
              description: 'Use spot instance for cost savings',
              default: false
            },
            maxPrice: {
              type: 'string',
              description: 'Maximum spot instance price',
              default: '0.10'
            },
            imageId: {
              type: 'string',
              description: 'Custom AMI ID (optional)'
            },
            region: {
              type: 'string',
              description: 'AWS region',
              default: 'us-east-1'
            }
          },
          required: ['name']
        }
      },

      vm_list: {
        name: 'vm_list',
        description: 'List all VM instances',
        inputSchema: {
          type: 'object',
          properties: {
            includeTerminated: {
              type: 'boolean',
              description: 'Include terminated instances in the list',
              default: false
            },
            name: {
              type: 'string',
              description: 'Filter by specific VM name'
            }
          }
        }
      },

      vm_start: {
        name: 'vm_start',
        description: 'Start a stopped VM instance',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            }
          },
          required: ['identifier']
        }
      },

      vm_stop: {
        name: 'vm_stop',
        description: 'Stop a running VM instance',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            }
          },
          required: ['identifier']
        }
      },

      vm_terminate: {
        name: 'vm_terminate',
        description: 'Terminate a VM instance (permanent destruction)',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation that you want to permanently destroy the VM',
              default: false
            }
          },
          required: ['identifier', 'confirm']
        }
      },

      vm_status: {
        name: 'vm_status',
        description: 'Get detailed status of a VM instance',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            }
          },
          required: ['identifier']
        }
      },

      vm_ssh: {
        name: 'vm_ssh',
        description: 'Get SSH connection information for a VM',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            },
            keyPath: {
              type: 'string',
              description: 'Path to SSH private key',
              default: '~/.ssh/claude-dev-key.pem'
            },
            username: {
              type: 'string',
              description: 'SSH username',
              default: 'ubuntu'
            }
          },
          required: ['identifier']
        }
      },

      vm_create_image: {
        name: 'vm_create_image',
        description: 'Create an AMI from a VM instance',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'VM name or instance ID'
            },
            imageName: {
              type: 'string',
              description: 'Name for the new AMI'
            },
            description: {
              type: 'string',
              description: 'Description for the AMI'
            }
          },
          required: ['identifier', 'imageName']
        }
      },

      vm_bulk_create: {
        name: 'vm_bulk_create',
        description: 'Create multiple VM instances for parallel development',
        inputSchema: {
          type: 'object',
          properties: {
            namePrefix: {
              type: 'string',
              description: 'Prefix for VM names (will append numbers)'
            },
            count: {
              type: 'number',
              description: 'Number of VMs to create',
              minimum: 1,
              maximum: 10
            },
            instanceType: {
              type: 'string',
              description: 'AWS instance type',
              default: 'm5.xlarge'
            },
            spot: {
              type: 'boolean',
              description: 'Use spot instances',
              default: true
            }
          },
          required: ['namePrefix', 'count']
        }
      }
    };
  }

  /**
   * Handle VM creation
   */
  async vm_create(params) {
    try {
      const { name, instanceType, spot, maxPrice, imageId, region } = params;
      
      const options = {};
      if (instanceType) options.instanceType = instanceType;
      if (spot) options.spot = true;
      if (maxPrice) options.maxPrice = maxPrice;
      if (imageId) options.imageId = imageId;

      const instance = await this.vmManager.createInstance(name, options);
      
      return {
        success: true,
        instance: {
          instanceId: instance.instanceId,
          name: instance.name,
          status: instance.status,
          publicIp: instance.publicIp,
          privateIp: instance.privateIp,
          instanceType: instance.config?.instanceType,
          spot: instance.config?.spot || false
        },
        message: `VM instance '${name}' created successfully`,
        sshCommand: this.vmManager.getSSHCommand(instance.instanceId)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to create VM instance '${params.name}'`
      };
    }
  }

  /**
   * Handle VM listing
   */
  async vm_list(params = {}) {
    try {
      const instances = await this.vmManager.listInstances(params);
      
      const summary = instances.reduce((acc, instance) => {
        acc[instance.status] = (acc[instance.status] || 0) + 1;
        return acc;
      }, {});

      return {
        success: true,
        instances: instances.map(instance => ({
          instanceId: instance.instanceId,
          name: instance.name,
          status: instance.status,
          publicIp: instance.publicIp,
          privateIp: instance.privateIp,
          instanceType: instance.config?.instanceType,
          created: instance.created,
          uptime: instance.created ? Date.now() - new Date(instance.created) : 0
        })),
        summary,
        total: instances.length,
        message: `Found ${instances.length} VM instances`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to list VM instances'
      };
    }
  }

  /**
   * Handle VM start
   */
  async vm_start(params) {
    try {
      const { identifier } = params;
      
      await this.vmManager.startInstance(identifier);
      
      // Get updated instance info
      await this.vmManager.updateInstanceInfo(
        this.vmManager.resolveInstanceId(identifier)
      );
      
      return {
        success: true,
        message: `VM instance '${identifier}' started successfully`,
        sshCommand: this.vmManager.getSSHCommand(identifier)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to start VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle VM stop
   */
  async vm_stop(params) {
    try {
      const { identifier } = params;
      
      await this.vmManager.stopInstance(identifier);
      
      return {
        success: true,
        message: `VM instance '${identifier}' stopped successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to stop VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle VM termination
   */
  async vm_terminate(params) {
    try {
      const { identifier, confirm } = params;
      
      if (!confirm) {
        return {
          success: false,
          error: 'Confirmation required',
          message: 'You must set confirm=true to terminate a VM instance (permanent destruction)'
        };
      }
      
      await this.vmManager.terminateInstance(identifier);
      
      return {
        success: true,
        message: `VM instance '${identifier}' terminated successfully`,
        warning: 'All data on the instance has been permanently destroyed'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to terminate VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle VM status check
   */
  async vm_status(params) {
    try {
      const { identifier } = params;
      
      const metrics = await this.vmManager.getInstanceMetrics(identifier);
      
      if (!metrics) {
        return {
          success: false,
          error: 'Instance not found',
          message: `VM instance '${identifier}' not found`
        };
      }

      return {
        success: true,
        status: {
          instanceId: metrics.instanceId,
          status: metrics.status,
          publicIp: metrics.publicIp,
          privateIp: metrics.privateIp,
          uptime: metrics.uptime,
          lastUpdated: metrics.lastUpdated
        },
        sshCommand: metrics.status === 'running' && metrics.publicIp 
          ? this.vmManager.getSSHCommand(identifier) 
          : null,
        message: `VM instance '${identifier}' status retrieved`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to get status for VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle SSH command generation
   */
  async vm_ssh(params) {
    try {
      const { identifier, keyPath, username } = params;
      
      const sshCommand = this.vmManager.getSSHCommand(identifier, {
        keyPath,
        username
      });
      
      return {
        success: true,
        sshCommand,
        message: `SSH command generated for VM instance '${identifier}'`,
        instructions: [
          'Copy and paste the SSH command to connect to your VM',
          'Ensure your SSH key has correct permissions: chmod 400 ~/.ssh/your-key.pem',
          'Add your GitHub SSH key on the VM for git operations'
        ]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to generate SSH command for VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle AMI creation
   */
  async vm_create_image(params) {
    try {
      const { identifier, imageName, description } = params;
      
      const imageId = await this.vmManager.createImage(
        identifier,
        imageName,
        description
      );
      
      return {
        success: true,
        imageId,
        imageName,
        message: `AMI creation initiated for VM instance '${identifier}'`,
        note: 'AMI creation may take several minutes to complete'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to create AMI from VM instance '${params.identifier}'`
      };
    }
  }

  /**
   * Handle bulk VM creation
   */
  async vm_bulk_create(params) {
    try {
      const { namePrefix, count, instanceType, spot } = params;
      
      const results = [];
      const failures = [];
      
      console.log(`🚀 Creating ${count} VM instances with prefix '${namePrefix}'...`);
      
      for (let i = 1; i <= count; i++) {
        const name = `${namePrefix}-${i}`;
        
        try {
          const options = {
            instanceType: instanceType || 'm5.xlarge',
            spot: spot !== undefined ? spot : true
          };
          
          const instance = await this.vmManager.createInstance(name, options);
          results.push(instance);
          
          console.log(`✅ Created VM ${i}/${count}: ${name} (${instance.instanceId})`);
          
        } catch (error) {
          console.error(`❌ Failed to create VM ${i}/${count}: ${name} - ${error.message}`);
          failures.push({ name, error: error.message });
        }
      }
      
      return {
        success: results.length > 0,
        created: results.length,
        failed: failures.length,
        total: count,
        instances: results.map(instance => ({
          name: instance.name,
          instanceId: instance.instanceId,
          status: instance.status
        })),
        failures,
        message: `Bulk creation completed: ${results.length}/${count} instances created successfully`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to execute bulk VM creation`
      };
    }
  }

  /**
   * Execute MCP tool by name
   */
  async executeTool(toolName, params) {
    const methodName = toolName;
    
    if (typeof this[methodName] === 'function') {
      return await this[methodName](params);
    } else {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
        message: `VM tool '${toolName}' not found`
      };
    }
  }

  /**
   * Get all tool definitions for MCP registration
   */
  getToolDefinitions() {
    return Object.values(this.tools);
  }
}

export default VMMCPTools;