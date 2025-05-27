#!/usr/bin/env node
/**
 * Error Scenario Tests for MCP Bridge
 * Tests bridge resilience and error handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

// Bridge helper that captures all outputs
async function bridgeRaw(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: path.join(process.cwd()),
            timeout: 10000
        });
        return { stdout, stderr, exitCode: 0 };
    } catch (error) {
        return { 
            stdout: error.stdout || '', 
            stderr: error.stderr || '', 
            exitCode: error.code || 1,
            error 
        };
    }
}

// Bridge helper with JSON parsing
async function bridge(command, params = {}) {
    const result = await bridgeRaw(command, params);
    try {
        return JSON.parse(result.stdout);
    } catch (e) {
        return { success: false, error: 'Invalid JSON response', raw: result.stdout };
    }
}

// Test suite for error scenarios
class BridgeErrorTests {
    constructor() {
        this.testResults = [];
        this.spawnedInstances = [];
    }

    async runTest(name, testFn) {
        console.log(`\n🧪 ${name}`);
        try {
            const result = await testFn.call(this);
            if (result.passed) {
                console.log(`   ✅ PASSED: ${result.message}`);
                this.testResults.push({ name, status: 'passed', message: result.message });
            } else {
                console.log(`   ❌ FAILED: ${result.message}`);
                this.testResults.push({ name, status: 'failed', message: result.message });
            }
        } catch (error) {
            console.log(`   💥 ERROR: ${error.message}`);
            this.testResults.push({ name, status: 'error', message: error.message });
        }
    }

    // Test 1: Invalid JSON parameters
    async testInvalidJSON() {
        const testCases = [
            { cmd: 'list', params: '{invalid json}' },
            { cmd: 'spawn', params: '{"role": missing quotes}' },
            { cmd: 'send', params: '{instanceId: no quotes}' },
            { cmd: 'read', params: 'not even json' },
            { cmd: 'terminate', params: '{}unclosed' }
        ];

        let passed = 0;
        for (const test of testCases) {
            const result = await bridgeRaw(test.cmd, test.params);
            // Should handle gracefully and return JSON error
            try {
                const response = JSON.parse(result.stdout);
                if (response.success === false && response.error) {
                    passed++;
                }
            } catch (e) {
                // Failed to return valid JSON on error
            }
        }

        return {
            passed: passed === testCases.length,
            message: `Handled ${passed}/${testCases.length} invalid JSON cases gracefully`
        };
    }

    // Test 2: Missing required parameters
    async testMissingParameters() {
        const testCases = [
            { 
                cmd: 'spawn', 
                params: { role: 'manager' }, // Missing workDir and context
                expectedError: 'spawn requires'
            },
            {
                cmd: 'send',
                params: { text: 'hello' }, // Missing instanceId
                expectedError: 'send requires'
            },
            {
                cmd: 'read',
                params: {}, // Missing instanceId
                expectedError: 'read requires'
            },
            {
                cmd: 'terminate',
                params: {}, // Missing instanceId
                expectedError: 'terminate requires'
            }
        ];

        let passed = 0;
        for (const test of testCases) {
            const result = await bridge(test.cmd, test.params);
            if (!result.success && result.error.includes(test.expectedError)) {
                passed++;
            }
        }

        return {
            passed: passed === testCases.length,
            message: `Validated ${passed}/${testCases.length} missing parameter cases`
        };
    }

    // Test 3: Invalid instance IDs
    async testInvalidInstanceIds() {
        const invalidIds = [
            'invalid_format',
            'mgr-wrong-separator',
            '12345',
            'exec_abc_not_numeric',
            '',
            null,
            undefined
        ];

        let handled = 0;
        for (const id of invalidIds) {
            // Test with read
            const readResult = await bridge('read', { instanceId: id });
            if (!readResult.success) handled++;

            // Test with send
            const sendResult = await bridge('send', { instanceId: id, text: 'test' });
            if (!sendResult.success) handled++;

            // Test with terminate
            const termResult = await bridge('terminate', { instanceId: id });
            if (!termResult.success) handled++;
        }

        const total = invalidIds.length * 3;
        return {
            passed: handled === total,
            message: `Handled ${handled}/${total} invalid instance ID operations`
        };
    }

    // Test 4: Operations on non-existent instances
    async testNonExistentInstances() {
        const fakeIds = [
            'exec_999999999',
            'mgr_888888888',
            'spec_777777777'
        ];

        let handled = 0;
        for (const id of fakeIds) {
            const readResult = await bridge('read', { instanceId: id });
            if (!readResult.success && readResult.error) handled++;

            const sendResult = await bridge('send', { instanceId: id, text: 'test' });
            if (!sendResult.success && sendResult.error) handled++;
        }

        return {
            passed: handled === fakeIds.length * 2,
            message: `Handled ${handled}/${fakeIds.length * 2} operations on non-existent instances`
        };
    }

    // Test 5: State file corruption
    async testStateFileCorruption() {
        const stateFile = path.join(process.cwd(), 'state/instances.json');
        let originalContent = null;
        let handled = 0;

        try {
            // Backup original
            try {
                originalContent = await fs.readFile(stateFile, 'utf8');
            } catch (e) {
                // No state file yet
            }

            // Test 1: Corrupted JSON
            await fs.writeFile(stateFile, '{"instances": corrupted}');
            const result1 = await bridge('list');
            if (result1.success === false || result1.instances) handled++;

            // Test 2: Wrong structure
            await fs.writeFile(stateFile, '{"wrong": "structure"}');
            const result2 = await bridge('list');
            if (result2.success === false || result2.instances) handled++;

            // Test 3: Empty file
            await fs.writeFile(stateFile, '');
            const result3 = await bridge('list');
            if (result3.success === false || result3.instances) handled++;

            return {
                passed: handled >= 2,
                message: `Handled ${handled}/3 state file corruption scenarios`
            };

        } finally {
            // Restore original
            if (originalContent) {
                await fs.writeFile(stateFile, originalContent);
            }
        }
    }

    // Test 6: Concurrent modifications
    async testConcurrentModifications() {
        // Spawn a test instance
        const spawnResult = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/error-test',
            context: 'Error test manager',
            parentId: null
        });

        if (spawnResult.success) {
            this.spawnedInstances.push(spawnResult.instanceId);

            // Try concurrent operations on same instance
            const operations = [];
            for (let i = 0; i < 10; i++) {
                operations.push(bridge('send', {
                    instanceId: spawnResult.instanceId,
                    text: `Concurrent message ${i}`
                }));
            }

            const results = await Promise.all(operations);
            const successful = results.filter(r => r.success).length;

            // Should handle all concurrent sends
            return {
                passed: successful >= 8, // Allow some failures
                message: `Handled ${successful}/10 concurrent operations`
            };
        }

        return {
            passed: false,
            message: 'Failed to spawn test instance'
        };
    }

    // Test 7: Bridge script errors
    async testBridgeScriptErrors() {
        const testCases = [
            // Unknown command
            { cmd: 'unknown_command', params: {}, shouldFail: true },
            // No command
            { cmd: '', params: {}, shouldFail: true },
            // Very long parameter
            { 
                cmd: 'send', 
                params: { 
                    instanceId: 'test', 
                    text: 'x'.repeat(10000) // 10k character message
                },
                shouldFail: false // Should handle gracefully
            }
        ];

        let handled = 0;
        for (const test of testCases) {
            const result = await bridgeRaw(test.cmd, test.params);
            try {
                const response = JSON.parse(result.stdout);
                if (test.shouldFail && !response.success) handled++;
                if (!test.shouldFail && response.success !== undefined) handled++;
            } catch (e) {
                // Should always return JSON
            }
        }

        return {
            passed: handled >= 2,
            message: `Handled ${handled}/${testCases.length} bridge script error cases`
        };
    }

    // Test 8: Recovery after errors
    async testErrorRecovery() {
        // Cause an error
        await bridge('terminate', { instanceId: 'non_existent' });

        // Should still work after error
        const listResult = await bridge('list');
        
        return {
            passed: listResult.success === true && Array.isArray(listResult.instances),
            message: 'Bridge recovered after error and continued working'
        };
    }

    // Cleanup
    async cleanup() {
        for (const id of this.spawnedInstances) {
            try {
                await bridge('terminate', { instanceId: id });
            } catch (e) {
                // Ignore
            }
        }
    }

    // Run all tests
    async runAllTests() {
        console.log('🛡️  MCP Bridge Error Scenario Tests\n');
        console.log('Testing bridge resilience and error handling...');

        await this.runTest('Invalid JSON Parameters', this.testInvalidJSON);
        await this.runTest('Missing Required Parameters', this.testMissingParameters);
        await this.runTest('Invalid Instance IDs', this.testInvalidInstanceIds);
        await this.runTest('Non-existent Instances', this.testNonExistentInstances);
        await this.runTest('State File Corruption', this.testStateFileCorruption);
        await this.runTest('Concurrent Modifications', this.testConcurrentModifications);
        await this.runTest('Bridge Script Errors', this.testBridgeScriptErrors);
        await this.runTest('Error Recovery', this.testErrorRecovery);

        // Cleanup
        await this.cleanup();

        // Summary
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const errors = this.testResults.filter(r => r.status === 'error').length;

        console.log('\n📊 Error Test Summary:');
        console.log(`   Total Tests: ${this.testResults.length}`);
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   💥 Errors: ${errors}`);

        if (failed > 0 || errors > 0) {
            console.log('\nFailed/Error tests:');
            this.testResults
                .filter(r => r.status !== 'passed')
                .forEach(r => console.log(`   - ${r.name}: ${r.message}`));
        }

        const success = failed === 0 && errors === 0;
        console.log(success 
            ? '\n✅ All error scenarios handled correctly!' 
            : '\n❌ Some error scenarios not handled properly');

        return success;
    }
}

// Run the tests
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const tester = new BridgeErrorTests();
    
    tester.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test suite crashed:', error);
            process.exit(1);
        });
}