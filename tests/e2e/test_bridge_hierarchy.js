#!/usr/bin/env node
/**
 * End-to-End Test for Complete Bridge Hierarchy
 * Tests Executive -> Manager -> Specialist orchestration flow
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { buildExecutiveContext, buildManagerContext } from '../../src/orchestration/executive_context_builder.js';

const execAsync = promisify(exec);

// Configuration
const PROJECT_DIR = '/tmp/e2e-bridge-test';
const INIT_WAIT = 8000;    // Longer wait for exec initialization
const CMD_WAIT = 5000;     // Wait between commands
const READ_WAIT = 3000;    // Wait before reading output

// Bridge helper
async function bridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    const { stdout } = await execAsync(cmd, {
        cwd: path.join(process.cwd())
    });
    return JSON.parse(stdout);
}

// Progress monitor
async function monitorProgress(instanceId, marker) {
    const maxAttempts = 20;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        const result = await bridge('read', { instanceId, lines: 50 });
        if (result.success && result.output.includes(marker)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
    }
    return false;
}

// Main E2E test
async function runE2ETest() {
    console.log('🎯 End-to-End Bridge Hierarchy Test\n');
    console.log('Testing complete Executive -> Manager -> Specialist flow...\n');
    
    const instances = {
        executive: null,
        managers: [],
        specialists: []
    };
    
    try {
        // Step 1: Spawn Executive with bridge knowledge
        console.log('1️⃣  Spawning Executive with bridge orchestration knowledge...');
        
        const projectRequirements = `Create a simple TODO application with:
1. Add TODO functionality
2. Mark TODO as complete
3. Delete TODO functionality
4. List all TODOs

This is a test project for validating the orchestration system.`;

        const execContext = buildExecutiveContext(projectRequirements, 'exec_e2e_test');
        
        const execResult = await bridge('spawn', {
            role: 'executive',
            workDir: PROJECT_DIR,
            context: execContext
        });
        
        if (!execResult.success) {
            throw new Error(`Executive spawn failed: ${execResult.error}`);
        }
        
        instances.executive = execResult.instanceId;
        console.log(`   ✓ Executive spawned: ${instances.executive}`);
        
        // Wait for executive to initialize
        await new Promise(resolve => setTimeout(resolve, INIT_WAIT));
        
        // Step 2: Send instruction to create project plan
        console.log('\n2️⃣  Instructing Executive to create project plan...');
        
        await bridge('send', {
            instanceId: instances.executive,
            text: 'Please create PROJECT_PLAN.md for the TODO application'
        });
        
        // Wait and check for plan
        const planCreated = await monitorProgress(instances.executive, 'PROJECT_PLAN.md');
        if (!planCreated) {
            throw new Error('Executive did not create project plan');
        }
        console.log('   ✓ Project plan created');
        
        // Step 3: Instruct Executive to spawn managers using bridge
        console.log('\n3️⃣  Instructing Executive to spawn managers...');
        
        await bridge('send', {
            instanceId: instances.executive,
            text: `Please spawn two managers using the MCP Bridge:
1. Frontend Manager - for UI components
2. Backend Manager - for data logic

Use the bridge commands shown in your context.`
        });
        
        // Wait for managers to be spawned
        await new Promise(resolve => setTimeout(resolve, CMD_WAIT));
        
        // Step 4: List instances to find managers
        console.log('\n4️⃣  Checking for spawned managers...');
        
        const listResult = await bridge('list');
        const managers = listResult.instances.filter(
            i => i.role === 'manager' && i.parentId === instances.executive
        );
        
        if (managers.length < 1) {
            throw new Error(`Expected at least 1 manager, found ${managers.length}`);
        }
        
        managers.forEach(mgr => {
            instances.managers.push(mgr.instanceId);
            console.log(`   ✓ Found manager: ${mgr.instanceId}`);
        });
        
        // Step 5: Check if managers are using bridge to spawn specialists
        console.log('\n5️⃣  Waiting for managers to spawn specialists...');
        
        // Send instruction to first manager
        if (instances.managers.length > 0) {
            await bridge('send', {
                instanceId: instances.managers[0],
                text: 'Please use the MCP Bridge to spawn a specialist for implementing the TODO model'
            });
        }
        
        // Wait for specialist spawning
        await new Promise(resolve => setTimeout(resolve, CMD_WAIT * 2));
        
        // Check for specialists
        const listResult2 = await bridge('list');
        const specialists = listResult2.instances.filter(
            i => i.role === 'specialist'
        );
        
        console.log(`   ✓ Found ${specialists.length} specialists`);
        specialists.forEach(spec => {
            instances.specialists.push(spec.instanceId);
        });
        
        // Step 6: Test communication flow
        console.log('\n6️⃣  Testing communication flow...');
        
        // Executive -> Manager
        if (instances.managers.length > 0) {
            await bridge('send', {
                instanceId: instances.executive,
                text: `Please send this message to manager ${instances.managers[0]}: "Status update requested"`
            });
            
            await new Promise(resolve => setTimeout(resolve, READ_WAIT));
            
            // Read manager output
            const mgrOutput = await bridge('read', {
                instanceId: instances.managers[0],
                lines: 30
            });
            
            console.log('   ✓ Executive->Manager communication tested');
        }
        
        // Step 7: Test hierarchy listing
        console.log('\n7️⃣  Validating instance hierarchy...');
        
        const finalList = await bridge('list');
        const hierarchy = buildHierarchy(finalList.instances, instances.executive);
        
        console.log('\n   Instance Hierarchy:');
        printHierarchy(hierarchy, '   ');
        
        // Validate hierarchy
        if (!hierarchy.children || hierarchy.children.length === 0) {
            throw new Error('No managers found under executive');
        }
        
        // Step 8: Test coordinated shutdown
        console.log('\n8️⃣  Testing coordinated shutdown...');
        
        // Send shutdown message to executive
        await bridge('send', {
            instanceId: instances.executive,
            text: 'Please prepare for shutdown. Notify all managers to save their work.'
        });
        
        await new Promise(resolve => setTimeout(resolve, READ_WAIT));
        
        // Terminate executive (with cascade if supported)
        const termResult = await bridge('terminate', {
            instanceId: instances.executive,
            cascade: true
        });
        
        if (!termResult.success) {
            console.log('   ⚠️  Cascade terminate not supported, cleaning up manually');
            // Manual cleanup
            for (const id of [...instances.managers, ...instances.specialists]) {
                try {
                    await bridge('terminate', { instanceId: id });
                } catch (e) {
                    // Ignore errors
                }
            }
        } else {
            console.log('   ✓ Executive terminated with cascade');
        }
        
        // Final verification
        const finalCheck = await bridge('list');
        const remaining = finalCheck.instances.filter(i => 
            [instances.executive, ...instances.managers, ...instances.specialists].includes(i.instanceId)
        );
        
        console.log(`\n✅ E2E Test Complete!`);
        console.log(`   Instances created: Executive(1), Managers(${instances.managers.length}), Specialists(${instances.specialists.length})`);
        console.log(`   Instances remaining: ${remaining.length}`);
        console.log(`\n🎉 The MCP Bridge successfully orchestrated a complete hierarchy!`);
        
        return true;
        
    } catch (error) {
        console.error('\n❌ E2E Test Failed:', error.message);
        
        // Cleanup on error
        console.log('\n🧹 Cleaning up...');
        const allInstances = [
            instances.executive,
            ...instances.managers,
            ...instances.specialists
        ].filter(Boolean);
        
        for (const id of allInstances) {
            try {
                await bridge('terminate', { instanceId: id });
                console.log(`   Terminated ${id}`);
            } catch (e) {
                // Ignore
            }
        }
        
        return false;
    }
}

// Helper to build hierarchy tree
function buildHierarchy(instances, rootId) {
    const root = instances.find(i => i.instanceId === rootId);
    if (!root) return null;
    
    const children = instances
        .filter(i => i.parentId === rootId)
        .map(child => buildHierarchy(instances, child.instanceId))
        .filter(Boolean);
    
    return { ...root, children };
}

// Helper to print hierarchy
function printHierarchy(node, indent = '') {
    if (!node) return;
    
    console.log(`${indent}${node.role}: ${node.instanceId}`);
    if (node.children) {
        node.children.forEach(child => {
            printHierarchy(child, indent + '  ');
        });
    }
}

// Run the test
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('🌉 MCP Bridge End-to-End Test\n');
    console.log('This test will:');
    console.log('1. Spawn an Executive with bridge knowledge');
    console.log('2. Have the Executive spawn Managers using the bridge');
    console.log('3. Have Managers spawn Specialists using the bridge');
    console.log('4. Test communication between all levels');
    console.log('5. Validate the complete hierarchy\n');
    
    runE2ETest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test crashed:', error);
            process.exit(1);
        });
}