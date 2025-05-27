#!/usr/bin/env node
/**
 * Integration Tests for MCP Bridge Orchestration
 * Tests real orchestration flows with actual instance spawning
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds per test
const INIT_WAIT = 5000;     // 5 seconds for instance initialization
const MESSAGE_WAIT = 3000;  // 3 seconds for message processing

// Helper to run bridge commands
async function bridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    const { stdout } = await execAsync(cmd, {
        cwd: path.join(process.cwd())
    });
    return JSON.parse(stdout);
}

// Test suite
class BridgeOrchestrationTests {
    constructor() {
        this.spawnedInstances = [];
        this.testResults = {
            passed: 0,
            failed: 0,
            tests: []
        };
    }

    // Cleanup helper
    async cleanup() {
        console.log('\n🧹 Cleaning up test instances...');
        for (const instanceId of this.spawnedInstances) {
            try {
                await bridge('terminate', { instanceId });
                console.log(`   Terminated ${instanceId}`);
            } catch (e) {
                // Instance might already be terminated
            }
        }
        this.spawnedInstances = [];
    }

    // Test runner
    async runTest(name, testFn) {
        console.log(`\n📋 ${name}`);
        const startTime = Date.now();
        
        try {
            await testFn.call(this);
            const duration = Date.now() - startTime;
            console.log(`   ✅ PASSED (${duration}ms)`);
            this.testResults.passed++;
            this.testResults.tests.push({ name, status: 'passed', duration });
        } catch (error) {
            const duration = Date.now() - startTime;
            console.log(`   ❌ FAILED (${duration}ms)`);
            console.log(`      ${error.message}`);
            this.testResults.failed++;
            this.testResults.tests.push({ name, status: 'failed', duration, error: error.message });
        }
    }

    // Test 1: Basic spawn and list flow
    async testSpawnAndList() {
        // Get initial count
        const before = await bridge('list');
        const initialCount = before.count;
        
        // Spawn a test manager
        const spawnResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-test',
            context: 'Test Manager for integration testing. Say "READY: Test Manager"',
            parentId: null
        });
        
        if (!spawnResult.success) {
            throw new Error(`Spawn failed: ${spawnResult.error}`);
        }
        
        this.spawnedInstances.push(spawnResult.instanceId);
        console.log(`   Spawned: ${spawnResult.instanceId}`);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, INIT_WAIT));
        
        // List again
        const after = await bridge('list');
        if (after.count !== initialCount + 1) {
            throw new Error(`Expected count ${initialCount + 1}, got ${after.count}`);
        }
        
        // Verify instance in list
        const found = after.instances.find(i => i.instanceId === spawnResult.instanceId);
        if (!found) {
            throw new Error('Spawned instance not found in list');
        }
    }

    // Test 2: Send and read flow
    async testSendAndRead() {
        // Spawn instance
        const spawnResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-test',
            context: 'Echo Manager. When you receive a message, respond with "ECHO: " followed by the message.',
            parentId: null
        });
        
        this.spawnedInstances.push(spawnResult.instanceId);
        await new Promise(resolve => setTimeout(resolve, INIT_WAIT));
        
        // Send message
        const testMessage = 'Hello from integration test!';
        const sendResult = await bridge('send', {
            instanceId: spawnResult.instanceId,
            text: testMessage
        });
        
        if (!sendResult.success) {
            throw new Error('Send failed');
        }
        
        // Wait for processing
        await new Promise(resolve => setTimeout(resolve, MESSAGE_WAIT));
        
        // Read output
        const readResult = await bridge('read', {
            instanceId: spawnResult.instanceId,
            lines: 20
        });
        
        if (!readResult.success) {
            throw new Error('Read failed');
        }
        
        // Verify echo response
        if (!readResult.output.includes(testMessage)) {
            throw new Error('Message not found in output');
        }
    }

    // Test 3: Parent-child relationship
    async testParentChildRelationship() {
        // Spawn parent (executive)
        const parentResult = await bridge('spawn', {
            role: 'executive',
            workDir: '/tmp/bridge-test',
            context: 'Test Executive. You coordinate test managers.',
            parentId: null
        });
        
        this.spawnedInstances.push(parentResult.instanceId);
        await new Promise(resolve => setTimeout(resolve, INIT_WAIT));
        
        // Spawn child (manager)
        const childResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-test',
            context: 'Test Manager reporting to executive.',
            parentId: parentResult.instanceId
        });
        
        this.spawnedInstances.push(childResult.instanceId);
        
        // List and verify relationship
        const listResult = await bridge('list');
        const parent = listResult.instances.find(i => i.instanceId === parentResult.instanceId);
        const child = listResult.instances.find(i => i.instanceId === childResult.instanceId);
        
        if (!parent || !child) {
            throw new Error('Parent or child not found in list');
        }
        
        if (child.parentId !== parentResult.instanceId) {
            throw new Error(`Expected parentId ${parentResult.instanceId}, got ${child.parentId}`);
        }
    }

    // Test 4: Terminate cascade
    async testTerminateCascade() {
        // Create hierarchy: exec -> mgr -> spec
        const execResult = await bridge('spawn', {
            role: 'executive',
            workDir: '/tmp/bridge-test',
            context: 'Test Executive for cascade',
            parentId: null
        });
        
        this.spawnedInstances.push(execResult.instanceId);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const mgrResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-test',
            context: 'Test Manager for cascade',
            parentId: execResult.instanceId
        });
        
        this.spawnedInstances.push(mgrResult.instanceId);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const specResult = await bridge('spawn', {
            role: 'specialist',
            workDir: '/tmp/bridge-test',
            context: 'Test Specialist for cascade',
            parentId: mgrResult.instanceId
        });
        
        this.spawnedInstances.push(specResult.instanceId);
        
        // Verify all exist
        const beforeList = await bridge('list');
        const beforeCount = beforeList.count;
        
        // Terminate parent (should cascade)
        const termResult = await bridge('terminate', {
            instanceId: execResult.instanceId,
            cascade: true
        });
        
        if (!termResult.success) {
            throw new Error('Terminate failed');
        }
        
        // Remove from cleanup list
        this.spawnedInstances = this.spawnedInstances.filter(
            id => ![execResult.instanceId, mgrResult.instanceId, specResult.instanceId].includes(id)
        );
        
        // Verify cascade
        const afterList = await bridge('list');
        const afterCount = afterList.count;
        
        // Should have removed at least the executive
        if (afterCount >= beforeCount) {
            throw new Error('Terminate did not reduce instance count');
        }
    }

    // Test 5: Concurrent operations
    async testConcurrentOperations() {
        // Spawn multiple instances concurrently
        const spawnPromises = [];
        const numInstances = 3;
        
        for (let i = 0; i < numInstances; i++) {
            spawnPromises.push(bridge('spawn', {
                role: 'manager',
                workDir: '/tmp/bridge-test',
                context: `Concurrent Test Manager ${i}`,
                parentId: null
            }));
        }
        
        const spawnResults = await Promise.all(spawnPromises);
        
        // Track for cleanup
        spawnResults.forEach(r => {
            if (r.success) {
                this.spawnedInstances.push(r.instanceId);
            }
        });
        
        // All should succeed
        const failures = spawnResults.filter(r => !r.success);
        if (failures.length > 0) {
            throw new Error(`${failures.length} concurrent spawns failed`);
        }
        
        // Send messages to all concurrently
        const sendPromises = spawnResults.map((r, i) => 
            bridge('send', {
                instanceId: r.instanceId,
                text: `Message to instance ${i}`
            })
        );
        
        const sendResults = await Promise.all(sendPromises);
        const sendFailures = sendResults.filter(r => !r.success);
        
        if (sendFailures.length > 0) {
            throw new Error(`${sendFailures.length} concurrent sends failed`);
        }
    }

    // Test 6: Error scenarios
    async testErrorScenarios() {
        // Test 1: Invalid instance ID
        const readResult = await bridge('read', {
            instanceId: 'invalid_instance_id_12345'
        });
        
        if (readResult.success !== false) {
            throw new Error('Expected read to fail with invalid instance ID');
        }
        
        // Test 2: Send to non-existent instance
        const sendResult = await bridge('send', {
            instanceId: 'non_existent_12345',
            text: 'This should fail'
        });
        
        if (sendResult.success !== false) {
            throw new Error('Expected send to fail with non-existent instance');
        }
        
        // Test 3: Terminate already terminated
        const spawnResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-test',
            context: 'Manager to be terminated twice',
            parentId: null
        });
        
        if (spawnResult.success) {
            // First terminate should succeed
            const term1 = await bridge('terminate', { instanceId: spawnResult.instanceId });
            if (!term1.success) {
                throw new Error('First terminate failed');
            }
            
            // Second terminate should handle gracefully
            const term2 = await bridge('terminate', { instanceId: spawnResult.instanceId });
            // Should not crash, just return error
            if (term2.success !== false) {
                throw new Error('Expected second terminate to fail gracefully');
            }
        }
    }

    // Main test runner
    async runAllTests() {
        console.log('🚀 MCP Bridge Integration Tests\n');
        console.log('Testing real orchestration flows...');
        
        const tests = [
            { name: 'Spawn and List Flow', fn: this.testSpawnAndList },
            { name: 'Send and Read Flow', fn: this.testSendAndRead },
            { name: 'Parent-Child Relationships', fn: this.testParentChildRelationship },
            { name: 'Terminate Cascade', fn: this.testTerminateCascade },
            { name: 'Concurrent Operations', fn: this.testConcurrentOperations },
            { name: 'Error Scenarios', fn: this.testErrorScenarios }
        ];
        
        // Run each test
        for (const test of tests) {
            await this.runTest(test.name, test.fn);
            // Cleanup after each test
            await this.cleanup();
        }
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log(`   Total: ${this.testResults.passed + this.testResults.failed}`);
        console.log(`   ✅ Passed: ${this.testResults.passed}`);
        console.log(`   ❌ Failed: ${this.testResults.failed}`);
        
        if (this.testResults.failed > 0) {
            console.log('\nFailed tests:');
            this.testResults.tests
                .filter(t => t.status === 'failed')
                .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
        }
        
        // Final cleanup
        await this.cleanup();
        
        return this.testResults.failed === 0;
    }
}

// Run tests if executed directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const tester = new BridgeOrchestrationTests();
    
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 Test suite crashed:', error);
            tester.cleanup().then(() => process.exit(1));
        });
}