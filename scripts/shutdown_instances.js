#!/usr/bin/env node

/**
 * Instance Shutdown Command Utility
 * 
 * Provides easy commands to shutdown:
 * 1. All specialists
 * 2. All managers  
 * 3. Executive only
 * 4. All instances
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class InstanceShutdown {
    constructor() {
        this.bridgePath = path.join(__dirname, 'mcp_bridge.js');
    }

    /**
     * Get all active instances via MCP bridge
     */
    async getActiveInstances() {
        try {
            const result = execSync(`node "${this.bridgePath}" list '{}'`, { 
                encoding: 'utf8',
                cwd: path.dirname(__dirname)
            });
            
            const response = JSON.parse(result);
            if (response.success && response.data) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('Failed to get active instances:', error.message);
            return [];
        }
    }

    /**
     * Terminate instance via MCP bridge
     */
    async terminateInstance(instanceId) {
        try {
            const result = execSync(`node "${this.bridgePath}" terminate '{"instanceId":"${instanceId}"}'`, { 
                encoding: 'utf8',
                cwd: path.dirname(__dirname)
            });
            
            const response = JSON.parse(result);
            return response.success;
        } catch (error) {
            console.error(`Failed to terminate instance ${instanceId}:`, error.message);
            return false;
        }
    }

    /**
     * Shutdown all specialists (instances with role 'specialist')
     */
    async shutdownSpecialists() {
        const instances = await this.getActiveInstances();
        const specialists = instances.filter(inst => inst.role === 'specialist');
        
        console.log(`Found ${specialists.length} specialist instances`);
        
        let terminated = 0;
        for (const specialist of specialists) {
            console.log(`Terminating specialist: ${specialist.instanceId}`);
            const success = await this.terminateInstance(specialist.instanceId);
            if (success) {
                terminated++;
                console.log(`✓ Terminated ${specialist.instanceId}`);
            } else {
                console.log(`✗ Failed to terminate ${specialist.instanceId}`);
            }
        }
        
        console.log(`Terminated ${terminated}/${specialists.length} specialists`);
        return terminated;
    }

    /**
     * Shutdown all managers (instances with role 'manager')
     */
    async shutdownManagers() {
        const instances = await this.getActiveInstances();
        const managers = instances.filter(inst => inst.role === 'manager');
        
        console.log(`Found ${managers.length} manager instances`);
        
        let terminated = 0;
        for (const manager of managers) {
            console.log(`Terminating manager: ${manager.instanceId}`);
            const success = await this.terminateInstance(manager.instanceId);
            if (success) {
                terminated++;
                console.log(`✓ Terminated ${manager.instanceId}`);
            } else {
                console.log(`✗ Failed to terminate ${manager.instanceId}`);
            }
        }
        
        console.log(`Terminated ${terminated}/${managers.length} managers`);
        return terminated;
    }

    /**
     * Shutdown executive (instances with role 'executive')
     */
    async shutdownExecutive() {
        const instances = await this.getActiveInstances();
        const executives = instances.filter(inst => inst.role === 'executive');
        
        console.log(`Found ${executives.length} executive instances`);
        
        let terminated = 0;
        for (const executive of executives) {
            console.log(`Terminating executive: ${executive.instanceId}`);
            const success = await this.terminateInstance(executive.instanceId);
            if (success) {
                terminated++;
                console.log(`✓ Terminated ${executive.instanceId}`);
            } else {
                console.log(`✗ Failed to terminate ${executive.instanceId}`);
            }
        }
        
        console.log(`Terminated ${terminated}/${executives.length} executives`);
        return terminated;
    }

    /**
     * Shutdown all instances
     */
    async shutdownAll() {
        const instances = await this.getActiveInstances();
        
        console.log(`Found ${instances.length} total instances`);
        
        let terminated = 0;
        for (const instance of instances) {
            console.log(`Terminating ${instance.role}: ${instance.instanceId}`);
            const success = await this.terminateInstance(instance.instanceId);
            if (success) {
                terminated++;
                console.log(`✓ Terminated ${instance.instanceId}`);
            } else {
                console.log(`✗ Failed to terminate ${instance.instanceId}`);
            }
        }
        
        console.log(`Terminated ${terminated}/${instances.length} instances`);
        return terminated;
    }

    /**
     * Show usage information
     */
    showUsage() {
        console.log(`
Instance Shutdown Utility

Usage:
  node shutdown_instances.js <command>

Commands:
  specialists    Shutdown all specialist instances
  managers       Shutdown all manager instances  
  executive      Shutdown executive instances
  all           Shutdown all instances
  list          List all active instances
  help          Show this help message

Examples:
  node shutdown_instances.js specialists
  node shutdown_instances.js managers
  node shutdown_instances.js executive
  node shutdown_instances.js all
        `);
    }

    /**
     * List active instances
     */
    async listInstances() {
        const instances = await this.getActiveInstances();
        
        if (instances.length === 0) {
            console.log('No active instances found');
            return;
        }

        console.log(`\nActive instances (${instances.length}):`);
        console.log('─'.repeat(60));
        
        const grouped = instances.reduce((acc, inst) => {
            if (!acc[inst.role]) acc[inst.role] = [];
            acc[inst.role].push(inst);
            return acc;
        }, {});

        Object.entries(grouped).forEach(([role, insts]) => {
            console.log(`\n${role.toUpperCase()} (${insts.length}):`);
            insts.forEach(inst => {
                console.log(`  ${inst.instanceId} - ${inst.workDir || 'no workDir'}`);
            });
        });
        console.log();
    }
}

// Main execution
async function main() {
    const shutdown = new InstanceShutdown();
    const command = process.argv[2];

    switch (command) {
        case 'specialists':
            await shutdown.shutdownSpecialists();
            break;
        case 'managers':
            await shutdown.shutdownManagers();
            break;
        case 'executive':
            await shutdown.shutdownExecutive();
            break;
        case 'all':
            await shutdown.shutdownAll();
            break;
        case 'list':
            await shutdown.listInstances();
            break;
        case 'help':
        case '--help':
        case '-h':
            shutdown.showUsage();
            break;
        default:
            console.error(`Unknown command: ${command || '(none)'}`);
            shutdown.showUsage();
            process.exit(1);
    }
}

if (process.argv[1] === __filename) {
    main().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

export { InstanceShutdown };