#!/usr/bin/env node

/**
 * VM Integration Demo - Demonstrates the VM management capabilities
 * 
 * This demo shows how the VM integration works with the MCP system
 * Run in mock mode to see the functionality without creating real AWS resources
 */

import { VMMCPTools } from './vm_mcp_tools.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Demo runner
 */
async function runDemo() {
  console.log('🎬 VM Integration Demo');
  console.log('═'.repeat(50));
  console.log('This demo shows VM management capabilities in mock mode');
  console.log('(No real AWS resources will be created)\n');

  // Create VM MCP tools instance with mock manager
  const mockVMTools = new (class extends VMMCPTools {
    constructor() {
      super({ stateFile: join(__dirname, 'demo-vm-state.json') });
      // Use the mock manager that's already in the test suite
      this.vmManager = new (class {
        constructor() {
          this.state = { instances: {}, templates: {} };
        }
        
        async createInstance(name, options = {}) {
          const instanceId = `i-demo${Math.random().toString(36).substr(2, 8)}`;
          const instance = {
            instanceId,
            name,
            status: 'running',
            created: new Date().toISOString(),
            config: options,
            publicIp: '54.123.45.67',
            privateIp: '10.0.0.100'
          };
          this.state.instances[instanceId] = instance;
          console.log(`✅ Mock VM created: ${name} (${instanceId})`);
          return instance;
        }
        
        async listInstances() {
          return Object.values(this.state.instances);
        }
        
        async updateInstanceInfo() {
          // Mock update
        }
        
        async getInstanceMetrics(identifier) {
          const instance = Object.values(this.state.instances).find(i => 
            i.name === identifier || i.instanceId === identifier
          );
          if (!instance) return null;
          
          return {
            instanceId: instance.instanceId,
            status: instance.status,
            publicIp: instance.publicIp,
            privateIp: instance.privateIp,
            uptime: Date.now() - new Date(instance.created),
            lastUpdated: new Date().toISOString()
          };
        }
        
        getSSHCommand(identifier) {
          const instance = Object.values(this.state.instances).find(i => 
            i.name === identifier || i.instanceId === identifier
          );
          if (!instance) throw new Error('Instance not found');
          return `ssh -i ~/.ssh/claude-dev-key.pem ubuntu@${instance.publicIp}`;
        }
        
        async terminateInstance(identifier) {
          const instance = Object.values(this.state.instances).find(i => 
            i.name === identifier || i.instanceId === identifier
          );
          if (instance) {
            instance.status = 'terminated';
            console.log(`✅ Mock VM terminated: ${identifier}`);
          }
        }
      })();
    }
  })();

  try {
    // Demo 1: Create a development VM
    console.log('📋 Demo 1: Creating a development VM');
    console.log('-'.repeat(40));
    
    const createResult = await mockVMTools.vm_create({
      name: 'demo-dev-vm',
      instanceType: 'm5.large',
      spot: true,
      maxPrice: '0.10'
    });
    
    console.log('Result:', JSON.stringify(createResult, null, 2));
    console.log('');

    // Demo 2: List VMs
    console.log('📋 Demo 2: Listing all VMs');
    console.log('-'.repeat(40));
    
    const listResult = await mockVMTools.vm_list({});
    console.log('Result:', JSON.stringify(listResult, null, 2));
    console.log('');

    // Demo 3: Get VM status
    console.log('📋 Demo 3: Getting VM status');
    console.log('-'.repeat(40));
    
    const statusResult = await mockVMTools.vm_status({
      identifier: 'demo-dev-vm'
    });
    
    console.log('Result:', JSON.stringify(statusResult, null, 2));
    console.log('');

    // Demo 4: Get SSH command
    console.log('📋 Demo 4: Getting SSH connection info');
    console.log('-'.repeat(40));
    
    const sshResult = await mockVMTools.vm_ssh({
      identifier: 'demo-dev-vm'
    });
    
    console.log('Result:', JSON.stringify(sshResult, null, 2));
    console.log('');

    // Demo 5: Bulk creation
    console.log('📋 Demo 5: Bulk VM creation');
    console.log('-'.repeat(40));
    
    const bulkResult = await mockVMTools.vm_bulk_create({
      namePrefix: 'demo-bulk',
      count: 3,
      instanceType: 'm5.medium',
      spot: true
    });
    
    console.log('Result:', JSON.stringify(bulkResult, null, 2));
    console.log('');

    // Demo 6: List all VMs after bulk creation
    console.log('📋 Demo 6: Final VM list');
    console.log('-'.repeat(40));
    
    const finalListResult = await mockVMTools.vm_list({});
    console.log('Result:', JSON.stringify(finalListResult, null, 2));
    console.log('');

    // Demo 7: Show available MCP tools
    console.log('📋 Demo 7: Available MCP Tools');
    console.log('-'.repeat(40));
    
    const toolDefinitions = mockVMTools.getToolDefinitions();
    console.log(`Total VM MCP Tools: ${toolDefinitions.length}`);
    console.log('');
    
    toolDefinitions.forEach(tool => {
      console.log(`🔧 ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Required params: ${tool.inputSchema.required || 'none'}`);
      console.log('');
    });

    console.log('🎉 VM Integration Demo completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('1. Configure AWS CLI: aws configure');
    console.log('2. Create key pair: aws ec2 create-key-pair --key-name claude-dev-key');
    console.log('3. Create security group: aws ec2 create-security-group --group-name claude-dev-sg');
    console.log('4. Start creating real VMs: npm run vm:create my-first-vm');
    console.log('\n📚 For full documentation, see: vm-integration/README.md');

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    if (process.env.VM_DEMO_VERBOSE) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(error => {
    console.error('Demo error:', error);
    process.exit(1);
  });
}

export default runDemo;