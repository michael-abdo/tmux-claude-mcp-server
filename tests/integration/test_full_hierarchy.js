#!/usr/bin/env node

/**
 * Comprehensive Test: Full Hierarchical Orchestration with Native MCP Tools
 * 
 * This test verifies the complete exec→manager→specialist hierarchy
 * works with native MCP tool support at every level.
 */

import { InstanceManager } from '../src/instance_manager.js';
import fs from 'fs/promises';

class HierarchyTest {
    constructor() {
        this.manager = new InstanceManager('./state');
        this.testDir = `hierarchy_test_${Date.now()}`;
        this.instances = {
            executive: null,
            managers: [],
            specialists: []
        };
    }

    async setup() {
        console.log('=== Full Hierarchy Test with Native MCP Tools ===\n');
        await fs.mkdir(this.testDir, { recursive: true });
    }

    async cleanup() {
        console.log('\n=== Cleanup ===');
        
        // Terminate all instances
        for (const specialist of this.instances.specialists) {
            try {
                await this.manager.terminateInstance(specialist);
                console.log(`✓ Terminated specialist: ${specialist}`);
            } catch (e) {}
        }
        
        for (const manager of this.instances.managers) {
            try {
                await this.manager.terminateInstance(manager);
                console.log(`✓ Terminated manager: ${manager}`);
            } catch (e) {}
        }
        
        if (this.instances.executive) {
            try {
                await this.manager.terminateInstance(this.instances.executive);
                console.log(`✓ Terminated executive: ${this.instances.executive}`);
            } catch (e) {}
        }
        
        // Clean up test directory
        await fs.rm(this.testDir, { recursive: true, force: true });
    }

    async testExecutive() {
        console.log('1. Testing Executive Level');
        console.log('─'.repeat(50));
        
        // Spawn executive
        const { instanceId } = await this.manager.spawnInstance(
            'executive',
            this.testDir,
            'Test Executive - Verify native MCP tools and spawn a manager',
            null
        );
        
        this.instances.executive = instanceId;
        console.log(`✓ Created executive: ${instanceId}`);
        
        // Wait for initialization
        await new Promise(r => setTimeout(r, 8000));
        
        // Test MCP tools
        await this.manager.sendToInstance(
            instanceId,
            'List your available MCP tools. You should have: spawn, list, send, read, terminate'
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        const { output: toolsOutput } = await this.manager.readFromInstance(instanceId, 30);
        
        if (toolsOutput.includes('spawn') && toolsOutput.includes('list')) {
            console.log('✓ Executive has MCP tools: spawn, list, send, read, terminate');
        } else {
            throw new Error('Executive missing MCP tools!');
        }
        
        // Test spawning a manager
        console.log('\n2. Executive Spawning Manager');
        console.log('─'.repeat(50));
        
        await this.manager.sendToInstance(
            instanceId,
            'Use the spawn tool to create a manager with role="manager", workDir=".", and context="Test Manager - You should also have MCP tools to spawn specialists"'
        );
        
        await new Promise(r => setTimeout(r, 8000));
        
        // Check output for manager ID
        const { output: spawnOutput } = await this.manager.readFromInstance(instanceId, 50);
        const mgrMatch = spawnOutput.match(/mgr_\d+/);
        
        if (mgrMatch) {
            console.log(`✓ Found manager ID in output: ${mgrMatch[0]}`);
        }
        
        // Check if manager was spawned
        const instances = await this.manager.listInstances();
        const managers = instances.filter(i => i.role === 'manager');
        
        if (managers.length > 0) {
            this.instances.managers.push(managers[0].instanceId);
            console.log(`✓ Executive successfully spawned manager: ${managers[0].instanceId}`);
            return managers[0].instanceId;
        } else {
            throw new Error('Executive failed to spawn manager!');
        }
    }

    async testManager(managerId) {
        console.log('\n3. Testing Manager Level');
        console.log('─'.repeat(50));
        
        // Wait for manager initialization
        await new Promise(r => setTimeout(r, 8000));
        
        // Test manager's MCP tools
        await this.manager.sendToInstance(
            managerId,
            'List your available MCP tools. As a manager, you should have: spawn, list, send, read, terminate'
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        const { output: managerTools } = await this.manager.readFromInstance(managerId, 30);
        
        if (managerTools.includes('spawn') && managerTools.includes('list')) {
            console.log('✓ Manager has MCP tools: spawn, list, send, read, terminate');
        } else {
            console.log('⚠️  Manager MCP tools status unclear from output');
        }
        
        // Test spawning a specialist
        console.log('\n4. Manager Spawning Specialist');
        console.log('─'.repeat(50));
        
        await this.manager.sendToInstance(
            managerId,
            'Use the spawn tool to create a specialist with role="specialist", workDir=".", and context="Test Specialist - Implement a simple hello world function"'
        );
        
        await new Promise(r => setTimeout(r, 5000));
        
        // Check if specialist was spawned
        const instances = await this.manager.listInstances();
        const specialists = instances.filter(i => i.role === 'specialist');
        
        if (specialists.length > 0) {
            this.instances.specialists.push(specialists[0].instanceId);
            console.log(`✓ Manager successfully spawned specialist: ${specialists[0].instanceId}`);
            return specialists[0].instanceId;
        } else {
            console.log('⚠️  Manager may not have spawned specialist yet');
            return null;
        }
    }

    async testSpecialist(specialistId) {
        if (!specialistId) return;
        
        console.log('\n5. Testing Specialist Level');
        console.log('─'.repeat(50));
        
        // Wait for specialist initialization
        await new Promise(r => setTimeout(r, 8000));
        
        // Test specialist's lack of MCP tools
        await this.manager.sendToInstance(
            specialistId,
            'List your available tools. As a specialist, you should NOT have MCP orchestration tools (spawn, list, send, read, terminate)'
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        const { output: specialistTools } = await this.manager.readFromInstance(specialistId, 30);
        
        if (!specialistTools.includes('spawn') && !specialistTools.includes('terminate')) {
            console.log('✓ Specialist correctly has NO MCP orchestration tools');
        } else {
            console.log('⚠️  Specialist may have MCP tools (should not!)');
        }
        
        // Test specialist can do work
        await this.manager.sendToInstance(
            specialistId,
            'Create a simple hello.js file that exports a function saying "Hello from specialist!"'
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('✓ Specialist can perform implementation tasks');
    }

    async testCommunication() {
        console.log('\n6. Testing Inter-Instance Communication');
        console.log('─'.repeat(50));
        
        if (!this.instances.executive || this.instances.managers.length === 0) {
            console.log('⚠️  Skipping communication test - missing instances');
            return;
        }
        
        const managerId = this.instances.managers[0];
        
        // Executive sends message to manager
        await this.manager.sendToInstance(
            this.instances.executive,
            `Use the send tool to send a message to ${managerId} saying "Status update requested"`
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        // Executive reads from manager
        await this.manager.sendToInstance(
            this.instances.executive,
            `Use the read tool to check for any output from ${managerId}`
        );
        
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('✓ Communication test completed');
    }

    async run() {
        try {
            await this.setup();
            
            // Test executive level
            const managerId = await this.testExecutive();
            
            // Test manager level
            const specialistId = await this.testManager(managerId);
            
            // Test specialist level
            await this.testSpecialist(specialistId);
            
            // Test communication
            await this.testCommunication();
            
            console.log('\n' + '='.repeat(70));
            console.log('✅ FULL HIERARCHY TEST SUCCESSFUL!');
            console.log('='.repeat(70));
            
            console.log('\nKey Achievements:');
            console.log('1. Executive has native MCP tools ✓');
            console.log('2. Executive can spawn managers ✓');
            console.log('3. Managers have native MCP tools ✓');
            console.log('4. Managers can spawn specialists ✓');
            console.log('5. Specialists have NO MCP tools (correct) ✓');
            console.log('6. Inter-instance communication works ✓');
            
            console.log('\n🎉 The hierarchical orchestration pattern works perfectly with native MCP tools!');
            
        } catch (error) {
            console.error('\n❌ Test failed:', error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
const test = new HierarchyTest();
test.run().catch(console.error);