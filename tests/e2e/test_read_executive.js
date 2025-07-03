#!/usr/bin/env node
/**
 * Test reading from the existing Executive
 */

import { InstanceManager } from '../src/instance_manager.js';
import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';

async function main() {
    console.log('=== Testing Read from Executive ===\n');
    
    const instanceManager = new InstanceManager('./test-state-orchestration');
    const mcpTools = new EnhancedMCPTools(instanceManager);
    
    try {
        // Read from the existing Executive
        console.log('Reading from exec_499745...\n');
        
        const result = await mcpTools.read({ 
            instanceId: 'exec_499745',
            lines: 50
        });
        
        console.log('Read result:', JSON.stringify(result, null, 2));
        
        // Also try listing instances
        console.log('\n\nListing all instances:');
        const instances = await mcpTools.list();
        console.log(JSON.stringify(instances, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);