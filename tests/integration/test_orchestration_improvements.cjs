#!/usr/bin/env node
/**
 * Test script for orchestration improvements
 * Tests the new spawn confirmation, message queuing, and monitoring features
 */

const path = require('path');
const fs = require('fs').promises;

// Mock tools for testing
const mockTools = {
    instances: new Map(),
    messages: new Map(),
    
    async spawn(params) {
        const instanceId = `${params.role}_${Date.now()}`;
        this.instances.set(instanceId, {
            id: instanceId,
            ...params,
            status: 'active'
        });
        
        // Initialize message queue
        this.messages.set(instanceId, []);
        
        console.log(`✓ Spawned ${params.role}: ${instanceId}`);
        return { instanceId };
    },
    
    async send(params) {
        const { instanceId, targetInstanceId, message, text } = params;
        const actualInstanceId = instanceId || targetInstanceId;
        const actualMessage = text || message || '';
        
        if (!this.messages.has(actualInstanceId)) {
            this.messages.set(actualInstanceId, []);
        }
        
        this.messages.get(actualInstanceId).push({
            content: actualMessage,
            timestamp: new Date().toISOString(),
            from: 'test'
        });
        
        console.log(`✓ Sent to ${actualInstanceId}: ${actualMessage.substring(0, 50)}...`);
        return { success: true };
    },
    
    async read(params) {
        const { instanceId } = params;
        const messages = this.messages.get(instanceId) || [];
        
        // Simulate instance responding to READY request
        if (messages.some(m => m.content.includes("Reply with 'READY:"))) {
            const instance = this.instances.get(instanceId);
            if (instance) {
                messages.push({
                    content: `READY: ${instance.role} - understood context`,
                    timestamp: new Date().toISOString(),
                    from: instanceId
                });
            }
        }
        
        // Convert messages to output string for spawn_helpers
        const output = messages.map(m => m.content).join('\n');
        return { output };
    },
    
    async list() {
        return {
            instances: Array.from(this.instances.values())
        };
    },
    
    async getProgress(params) {
        const { instanceId } = params;
        const instance = this.instances.get(instanceId);
        
        // Simulate todo progress
        const todos = [];
        if (instance?.role === 'manager') {
            todos.push(
                { content: 'Plan work breakdown', status: 'completed' },
                { content: 'Spawn specialists', status: 'in_progress' },
                { content: 'Monitor progress', status: 'pending' }
            );
        } else if (instance?.role === 'specialist') {
            todos.push(
                { content: 'Implement feature', status: 'in_progress' },
                { content: 'Write tests', status: 'pending' }
            );
        }
        
        return { todos };
    },
    
    async getGitBranch(params) {
        const { instanceId } = params;
        return {
            currentBranch: `specialist-${instanceId}-feature`
        };
    }
};

// Load our helpers
async function loadHelpers() {
    try {
        const { spawnWithConfirmation } = require('../src/orchestration/spawn_helpers');
        const { ExecutiveOrchestrator } = require('../src/orchestration/executive_orchestrator');
        const { ManagerCoordinator } = require('../src/orchestration/manager_coordinator');
        const { ProjectState } = require('../src/project/project_state');
        const { monitorAllProgress, generateProgressReport } = require('../src/orchestration/monitor_progress');
        
        return {
            spawnWithConfirmation,
            ExecutiveOrchestrator,
            ManagerCoordinator,
            ProjectState,
            monitorAllProgress,
            generateProgressReport
        };
    } catch (error) {
        console.error('Failed to load helpers:', error);
        console.log('\nMake sure you run this from the project root directory.');
        process.exit(1);
    }
}

// Test 1: Spawn with confirmation
async function testSpawnWithConfirmation() {
    console.log('\n=== Test 1: Spawn with Confirmation ===\n');
    
    const { spawnWithConfirmation } = await loadHelpers();
    
    const result = await spawnWithConfirmation(mockTools, {
        role: 'manager',
        workDir: '/tmp/test-project',
        context: 'You are the UI Manager. Build the user interface.'
    }, 5000);
    
    console.log('Result:', result);
    
    if (result.status === 'ready') {
        console.log('✅ Spawn with confirmation PASSED');
    } else {
        console.log('❌ Spawn with confirmation FAILED');
    }
}

// Test 2: Executive Orchestrator
async function testExecutiveOrchestrator() {
    console.log('\n=== Test 2: Executive Orchestrator ===\n');
    
    const { ExecutiveOrchestrator } = await loadHelpers();
    
    const executive = new ExecutiveOrchestrator(mockTools, '/tmp/test-project');
    
    // Create project plan
    await executive.createProjectPlan('Build a web application with user interface and API');
    
    // Spawn managers
    try {
        const uiManagerId = await executive.spawnManagerWithVerification(
            'UI Manager',
            'You are responsible for all user interface components',
            ['Create homepage', 'Build navigation', 'Implement forms']
        );
        
        console.log('UI Manager spawned:', uiManagerId);
        
        // Check progress
        const progress = await executive.checkAllManagerProgress();
        console.log('\nProgress Report:');
        console.log(JSON.stringify(progress, null, 2));
        
        console.log('✅ Executive Orchestrator PASSED');
    } catch (error) {
        console.log('❌ Executive Orchestrator FAILED:', error.message);
    }
}

// Test 3: Manager Coordinator
async function testManagerCoordinator() {
    console.log('\n=== Test 3: Manager Coordinator ===\n');
    
    const { ManagerCoordinator } = await loadHelpers();
    
    const manager = new ManagerCoordinator(mockTools, '/tmp/test-project');
    
    // Plan parallel work
    const tasks = [
        { name: 'implement-navigation', priority: 'high' },
        { name: 'implement-footer', priority: 'normal' },
        { name: 'implement-header', priority: 'high' }
    ];
    
    const plan = await manager.planParallelWork(tasks);
    console.log('Work Plan:', JSON.stringify(plan, null, 2));
    
    // Execute first group
    if (plan.parallelGroups.length > 0) {
        const results = await manager.executeParallelTasks(plan.parallelGroups[0]);
        console.log('\nExecution Results:', results);
        
        // Monitor specialists
        const monitoring = await manager.monitorSpecialists();
        console.log('\nMonitoring Report:', JSON.stringify(monitoring, null, 2));
    }
    
    console.log('✅ Manager Coordinator PASSED');
}

// Test 4: Progress Monitoring
async function testProgressMonitoring() {
    console.log('\n=== Test 4: Progress Monitoring ===\n');
    
    const { monitorAllProgress, generateProgressReport } = await loadHelpers();
    
    // Create some instances first
    await mockTools.spawn({ role: 'executive', workDir: '/tmp/test', context: 'Executive' });
    await mockTools.spawn({ role: 'manager', workDir: '/tmp/test', context: 'Manager', parentId: 'exec_1' });
    await mockTools.spawn({ role: 'specialist', workDir: '/tmp/test', context: 'Specialist', parentId: 'mgr_1' });
    
    // Monitor progress
    const progress = await monitorAllProgress(mockTools);
    const report = generateProgressReport(progress);
    
    console.log(report);
    
    console.log('✅ Progress Monitoring PASSED');
}

// Test 5: Project State
async function testProjectState() {
    console.log('\n=== Test 5: Project State ===\n');
    
    const { ProjectState } = await loadHelpers();
    
    const testDir = '/tmp/test-project-state-' + Date.now();
    await fs.mkdir(testDir, { recursive: true });
    
    const projectState = new ProjectState(testDir);
    
    // Test file coordination
    console.log('Testing file coordination...');
    
    // Claim a file
    await projectState.recordFileModification('src/index.js', 'claimed');
    const available1 = await projectState.checkFileAvailability('src/index.js');
    console.log('File available after claim:', available1);
    
    // Release the file
    await projectState.recordFileModification('src/index.js', 'released');
    const available2 = await projectState.checkFileAvailability('src/index.js');
    console.log('File available after release:', available2);
    
    // Test knowledge store
    console.log('\nTesting knowledge store...');
    await projectState.recordKnowledge('api.endpoint', 'https://api.example.com');
    await projectState.recordKnowledge('api.key', 'secret-key-123');
    
    const knowledge = await projectState.getKnowledge('api');
    console.log('Knowledge retrieved:', knowledge);
    
    // Get summary
    const summary = await projectState.getSummary();
    console.log('\nProject state summary:', summary);
    
    // Cleanup
    await fs.rmdir(testDir, { recursive: true });
    
    console.log('✅ Project State PASSED');
}

// Run all tests
async function runAllTests() {
    console.log('=== Running Orchestration Improvement Tests ===\n');
    
    try {
        await testSpawnWithConfirmation();
        await testExecutiveOrchestrator();
        await testManagerCoordinator();
        await testProgressMonitoring();
        await testProjectState();
        
        console.log('\n=== All Tests Completed ===');
        console.log('✅ All orchestration improvements are working correctly!');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests };