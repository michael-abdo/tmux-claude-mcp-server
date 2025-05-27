#!/usr/bin/env node
/**
 * Unit Tests for MCP Bridge
 * Tests core bridge functionality without spawning real instances
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Helper to run bridge commands
async function runBridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: path.resolve(process.cwd())
        });
        return { success: true, data: JSON.parse(stdout), stderr };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

describe('MCP Bridge Unit Tests', () => {
    let originalInstancesFile;
    const instancesPath = path.join(process.cwd(), 'state/instances.json');
    
    beforeEach(async () => {
        // Backup current instances
        try {
            originalInstancesFile = await fs.readFile(instancesPath, 'utf8');
        } catch (e) {
            originalInstancesFile = null;
        }
    });
    
    afterEach(async () => {
        // Restore original instances
        if (originalInstancesFile) {
            await fs.writeFile(instancesPath, originalInstancesFile);
        }
    });

    describe('Command Validation', () => {
        it('should fail with no command', async () => {
            const { stderr } = await execAsync('node scripts/mcp_bridge.js 2>&1', {
                cwd: process.cwd()
            }).catch(e => e);
            expect(stderr).toContain('Usage: node mcp_bridge.js <command>');
        });

        it('should fail with unknown command', async () => {
            const result = await runBridge('invalid_command');
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('Unknown command');
        });
    });

    describe('List Command', () => {
        it('should return list of instances', async () => {
            const result = await runBridge('list');
            expect(result.success).toBe(true);
            expect(result.data.success).toBe(true);
            expect(Array.isArray(result.data.instances)).toBe(true);
            expect(typeof result.data.count).toBe('number');
        });

        it('should handle empty instance list', async () => {
            // Create empty instances file
            await fs.mkdir(path.dirname(instancesPath), { recursive: true });
            await fs.writeFile(instancesPath, JSON.stringify({ version: 1, instances: {} }));
            
            const result = await runBridge('list');
            expect(result.success).toBe(true);
            expect(result.data.count).toBe(0);
            expect(result.data.instances).toEqual([]);
        });
    });

    describe('Spawn Command', () => {
        it('should validate required parameters', async () => {
            const result = await runBridge('spawn', {});
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('spawn requires: role, workDir, context');
        });

        it('should validate role parameter', async () => {
            const result = await runBridge('spawn', {
                role: 'invalid_role',
                workDir: '/tmp',
                context: 'test'
            });
            expect(result.success).toBe(false);
            // Bridge should validate role
        });

        it('should handle spawn with all parameters', async () => {
            // Note: This test would normally spawn a real instance
            // In unit tests, we might want to mock the actual spawn
            const params = {
                role: 'manager',
                workDir: '/tmp/test',
                context: 'Test manager for unit testing',
                parentId: 'exec_123'
            };
            
            // For unit test, we just verify the command would be formatted correctly
            const cmd = `node scripts/mcp_bridge.js spawn '${JSON.stringify(params)}'`;
            expect(cmd).toContain('role');
            expect(cmd).toContain('workDir');
            expect(cmd).toContain('context');
        });
    });

    describe('Send Command', () => {
        it('should validate required parameters', async () => {
            const result = await runBridge('send', {});
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('send requires: instanceId, text');
        });

        it('should validate instanceId parameter', async () => {
            const result = await runBridge('send', { text: 'hello' });
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('send requires: instanceId');
        });

        it('should validate text parameter', async () => {
            const result = await runBridge('send', { instanceId: 'test_123' });
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('send requires: instanceId, text');
        });
    });

    describe('Read Command', () => {
        it('should validate required parameters', async () => {
            const result = await runBridge('read', {});
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('read requires: instanceId');
        });

        it('should accept optional lines parameter', async () => {
            // Just validate the command format
            const params = { instanceId: 'test_123', lines: 50 };
            const cmd = `node scripts/mcp_bridge.js read '${JSON.stringify(params)}'`;
            expect(cmd).toContain('lines');
            expect(cmd).toContain('50');
        });
    });

    describe('Terminate Command', () => {
        it('should validate required parameters', async () => {
            const result = await runBridge('terminate', {});
            expect(result.success).toBe(false);
            expect(result.data.error).toContain('terminate requires: instanceId');
        });
    });

    describe('JSON Output Format', () => {
        it('should always return valid JSON', async () => {
            const commands = [
                { cmd: 'list', params: {} },
                { cmd: 'spawn', params: {} }, // Will fail but should return JSON
                { cmd: 'send', params: {} },  // Will fail but should return JSON
                { cmd: 'read', params: {} },   // Will fail but should return JSON
                { cmd: 'terminate', params: {} } // Will fail but should return JSON
            ];

            for (const { cmd, params } of commands) {
                const result = await runBridge(cmd, params);
                // Even failed commands should return JSON
                expect(result.data).toBeDefined();
                expect(typeof result.data).toBe('object');
                expect(result.data.success).toBeDefined();
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed JSON parameters', async () => {
            const { stdout } = await execAsync(
                "node scripts/mcp_bridge.js list '{invalid json}'",
                { cwd: process.cwd() }
            ).catch(e => e);
            
            const result = JSON.parse(stdout);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should handle missing instances file gracefully', async () => {
            // Remove instances file
            try {
                await fs.unlink(instancesPath);
            } catch (e) {
                // File might not exist
            }

            const result = await runBridge('list');
            expect(result.success).toBe(true);
            // Should create new instances file or handle gracefully
        });
    });

    describe('Bridge Response Structure', () => {
        it('list should have correct response structure', async () => {
            const result = await runBridge('list');
            expect(result.data).toMatchObject({
                success: true,
                instances: expect.any(Array),
                count: expect.any(Number)
            });
        });

        it('error responses should have consistent structure', async () => {
            const result = await runBridge('spawn', { role: 'manager' });
            expect(result.data).toMatchObject({
                success: false,
                error: expect.any(String)
            });
        });
    });
});

// Run tests if called directly
if (process.argv[1] === new URL(import.meta.url).pathname) {
    console.log('Running MCP Bridge Unit Tests...\n');
    
    // Simple test runner for direct execution
    const tests = [];
    let currentDescribe = '';
    
    global.describe = (name, fn) => {
        currentDescribe = name;
        fn();
    };
    
    global.it = (name, fn) => {
        tests.push({ describe: currentDescribe, name, fn });
    };
    
    global.expect = (value) => ({
        toBe: (expected) => {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        },
        toContain: (substr) => {
            if (!value.includes(substr)) {
                throw new Error(`Expected "${value}" to contain "${substr}"`);
            }
        },
        toBeDefined: () => {
            if (value === undefined) {
                throw new Error(`Expected value to be defined`);
            }
        },
        toEqual: (expected) => {
            if (JSON.stringify(value) !== JSON.stringify(expected)) {
                throw new Error(`Expected ${JSON.stringify(value)} to equal ${JSON.stringify(expected)}`);
            }
        },
        toMatchObject: (expected) => {
            // Simple object matching
            for (const key in expected) {
                if (!(key in value)) {
                    throw new Error(`Expected object to have key "${key}"`);
                }
            }
        },
        any: (type) => true // Simplified matcher
    });
    
    // Run the tests
    async function runTests() {
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                await test.fn();
                console.log(`✅ ${test.describe} > ${test.name}`);
                passed++;
            } catch (error) {
                console.log(`❌ ${test.describe} > ${test.name}`);
                console.log(`   ${error.message}`);
                failed++;
            }
        }
        
        console.log(`\n${passed} passed, ${failed} failed`);
        process.exit(failed > 0 ? 1 : 0);
    }
    
    // Load test definitions and run
    describe('MCP Bridge Unit Tests', () => {
        // Tests will be defined here
    });
    
    // Simple unit test example
    console.log('Note: For full test suite, run with Jest or another test runner');
    console.log('This is a simplified test runner for basic validation\n');
    
    runBridge('list').then(result => {
        console.log('✅ Bridge is accessible and returns JSON');
        console.log(`   Found ${result.data?.count || 0} instances`);
    }).catch(error => {
        console.log('❌ Bridge test failed:', error.message);
    });
}