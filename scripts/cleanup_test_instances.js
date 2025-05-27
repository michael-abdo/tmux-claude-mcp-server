#!/usr/bin/env node

/**
 * Cleanup script to terminate test instances
 */

import { InstanceManager } from '../src/instance_manager.js';

async function cleanupTestInstances() {
    console.log('=== Cleaning Up Test Instances ===\n');
    
    try {
        // Initialize instance manager
        const manager = new InstanceManager('./state', { useRedis: false });
        await manager.loadInstances();
        
        // List all instances
        const instances = await manager.listInstances();
        console.log(`Found ${instances.length} active instances:`);
        
        if (instances.length === 0) {
            console.log('No instances to clean up.');
            return;
        }
        
        // Show instances
        instances.forEach(instance => {
            console.log(`  - ${instance.instanceId} (${instance.role}) - ${instance.status}`);
        });
        
        console.log('\nTerminating all instances...');
        
        // Terminate all instances
        for (const instance of instances) {
            try {
                await manager.terminateInstance(instance.instanceId, true);
                console.log(`✅ Terminated: ${instance.instanceId}`);
            } catch (error) {
                console.log(`❌ Failed to terminate ${instance.instanceId}: ${error.message}`);
            }
        }
        
        console.log('\n✅ Cleanup completed');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupTestInstances();