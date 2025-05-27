#!/usr/bin/env node

/**
 * Monitor and interact with test Executive instances
 */

import { InstanceManager } from '../src/instance_manager.js';

async function monitorTestExecutive() {
    console.log('=== Test Executive Monitor ===\n');
    
    try {
        // Initialize instance manager
        const manager = new InstanceManager('./state', { useRedis: false });
        await manager.loadInstances();
        
        // List all instances
        const instances = await manager.listInstances();
        
        if (instances.length === 0) {
            console.log('No active instances found. Run spawn_test_executive.js first.');
            return;
        }
        
        console.log(`Found ${instances.length} active instances:`);
        instances.forEach((instance, index) => {
            console.log(`  ${index + 1}. ${instance.instanceId} (${instance.role}) - ${instance.status}`);
            console.log(`     Session: claude_${instance.instanceId}`);
            console.log(`     Work Dir: ${instance.workDir}`);
        });
        
        // Find executives
        const executives = instances.filter(i => i.role === 'executive');
        
        if (executives.length > 0) {
            console.log(`\n🎯 Executive instances:`);
            executives.forEach(exec => {
                console.log(`   ${exec.instanceId}: tmux attach -t claude_${exec.instanceId}`);
            });
            
            // Show recent output from the first executive
            console.log(`\n📖 Recent output from ${executives[0].instanceId}:`);
            console.log('─'.repeat(80));
            
            try {
                const output = await manager.readFromInstance(executives[0].instanceId, 20);
                console.log(output.output);
            } catch (error) {
                console.log(`❌ Could not read output: ${error.message}`);
            }
            
            console.log('─'.repeat(80));
        }
        
        console.log(`\n💬 To send a message to an instance:`);
        console.log(`   node -e "import('./src/instance_manager.js').then(({InstanceManager}) => { const m = new InstanceManager('./state'); m.loadInstances().then(() => m.sendToInstance('INSTANCE_ID', 'YOUR_MESSAGE')) })"`);
        
        console.log(`\n🧹 To cleanup all instances:`);
        console.log(`   node cleanup_test_instances.js`);
        
    } catch (error) {
        console.error('❌ Monitor failed:', error);
        process.exit(1);
    }
}

monitorTestExecutive();