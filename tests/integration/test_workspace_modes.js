#!/usr/bin/env node
/**
 * Test workspace modes functionality
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { MCPTools } from '../../src/mcp_tools.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWorkspaceModes() {
    console.log('Testing workspace modes...\n');
    
    const testDir = path.join(__dirname, 'test-workspace-modes');
    await fs.ensureDir(testDir);
    
    const stateDir = path.join(testDir, 'state');
    await fs.ensureDir(stateDir);
    
    const instanceManager = new InstanceManager(stateDir);
    const mcpTools = new MCPTools(instanceManager);
    
    console.log('1. Testing isolated mode (default)...');
    try {
        const isolatedResult = await instanceManager.spawnInstance(
            'manager',
            testDir,
            'Test isolated manager',
            null
        );
        
        console.log(`✅ Isolated manager spawned: ${isolatedResult.instanceId}`);
        console.log(`   Project dir: ${isolatedResult.projectPath}`);
        
        // Verify it created a subdirectory
        const expectedDir = path.join(testDir, isolatedResult.instanceId);
        if (isolatedResult.projectPath === expectedDir) {
            console.log('✅ Correctly created subdirectory for isolated mode');
        } else {
            console.log('❌ Isolated mode directory mismatch');
        }
        
        // Cleanup
        await instanceManager.terminateInstance(isolatedResult.instanceId);
        await fs.remove(expectedDir);
        
    } catch (error) {
        console.error('❌ Isolated mode test failed:', error.message);
    }
    
    console.log('\n2. Testing shared mode for managers...');
    try {
        const sharedDir = path.join(testDir, 'shared-development');
        await fs.ensureDir(sharedDir);
        
        const sharedResult = await instanceManager.spawnInstance(
            'manager',
            sharedDir,
            'Test shared manager',
            null,
            { workspaceMode: 'shared' }
        );
        
        console.log(`✅ Shared manager spawned: ${sharedResult.instanceId}`);
        console.log(`   Project dir: ${sharedResult.projectPath}`);
        
        // Verify it uses the workDir directly
        if (sharedResult.projectPath === sharedDir) {
            console.log('✅ Correctly uses workDir directly for shared mode');
        } else {
            console.log('❌ Shared mode directory mismatch');
        }
        
        // Check for SHARED_WORKSPACE.md
        const sharedMarker = path.join(sharedDir, 'SHARED_WORKSPACE.md');
        if (await fs.pathExists(sharedMarker)) {
            console.log('✅ Created SHARED_WORKSPACE.md marker');
        } else {
            console.log('❌ Missing SHARED_WORKSPACE.md');
        }
        
        // Check for manager-specific CLAUDE.md location
        const managerClaudeDir = path.join(sharedDir, '.managers', sharedResult.instanceId);
        const managerClaudeMd = path.join(managerClaudeDir, 'CLAUDE.md');
        if (await fs.pathExists(managerClaudeMd)) {
            console.log('✅ CLAUDE.md placed in .managers subdirectory');
        } else {
            console.log('❌ CLAUDE.md not in correct location');
        }
        
        // Cleanup
        await instanceManager.terminateInstance(sharedResult.instanceId);
        
    } catch (error) {
        console.error('❌ Shared mode test failed:', error.message);
    }
    
    console.log('\n3. Testing MCP tools spawn with workspace mode...');
    try {
        const toolResult = await mcpTools.spawn({
            role: 'manager',
            workspaceMode: 'shared',
            workDir: path.join(testDir, 'mcp-shared'),
            context: 'Test manager via MCP tools'
        });
        
        console.log('✅ MCP tools spawn with shared mode succeeded');
        console.log(`   Instance: ${toolResult.instanceId}`);
        console.log(`   Workspace mode: ${toolResult.workspaceMode}`);
        
        // Cleanup
        await instanceManager.terminateInstance(toolResult.instanceId);
        
    } catch (error) {
        console.error('❌ MCP tools test failed:', error.message);
    }
    
    console.log('\n4. Testing workspace mode validation...');
    try {
        // Should fail - shared mode for executive
        await mcpTools.spawn({
            role: 'executive',
            workspaceMode: 'shared',
            workDir: testDir,
            context: 'Invalid test'
        });
        console.log('❌ Should have rejected shared mode for executive');
    } catch (error) {
        if (error.message.includes('Shared workspace mode is only available for managers')) {
            console.log('✅ Correctly rejected shared mode for executive');
        } else {
            console.log('❌ Wrong error for invalid workspace mode');
        }
    }
    
    console.log('\n5. Testing multiple managers in shared workspace...');
    try {
        const sharedProjectDir = path.join(testDir, 'multi-manager-test');
        await fs.ensureDir(sharedProjectDir);
        
        // Spawn first manager
        const mgr1 = await instanceManager.spawnInstance(
            'manager',
            sharedProjectDir,
            'UI Manager',
            null,
            { workspaceMode: 'shared' }
        );
        
        // Spawn second manager
        const mgr2 = await instanceManager.spawnInstance(
            'manager',
            sharedProjectDir,
            'Backend Manager',
            null,
            { workspaceMode: 'shared' }
        );
        
        console.log('✅ Spawned two managers in shared workspace');
        console.log(`   Manager 1: ${mgr1.instanceId} at ${mgr1.projectPath}`);
        console.log(`   Manager 2: ${mgr2.instanceId} at ${mgr2.projectPath}`);
        
        // Verify both use same directory
        if (mgr1.projectPath === mgr2.projectPath && mgr1.projectPath === sharedProjectDir) {
            console.log('✅ Both managers share the same workspace');
        } else {
            console.log('❌ Managers not sharing workspace correctly');
        }
        
        // Check both have separate CLAUDE.md files
        const mgr1Claude = path.join(sharedProjectDir, '.managers', mgr1.instanceId, 'CLAUDE.md');
        const mgr2Claude = path.join(sharedProjectDir, '.managers', mgr2.instanceId, 'CLAUDE.md');
        
        if (await fs.pathExists(mgr1Claude) && await fs.pathExists(mgr2Claude)) {
            console.log('✅ Each manager has separate CLAUDE.md in .managers');
        } else {
            console.log('❌ Manager CLAUDE.md files missing');
        }
        
        // Cleanup
        await instanceManager.terminateInstance(mgr1.instanceId);
        await instanceManager.terminateInstance(mgr2.instanceId);
        
    } catch (error) {
        console.error('❌ Multi-manager test failed:', error.message);
    }
    
    // Final cleanup
    await fs.remove(testDir);
    console.log('\n✅ All workspace mode tests completed');
}

// Run tests
testWorkspaceModes().catch(console.error);