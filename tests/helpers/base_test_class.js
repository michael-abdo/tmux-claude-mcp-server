#!/usr/bin/env node

/**
 * Base Test Class
 * Provides standardized setup, teardown, and resource management for all tests
 */

import { TestCleanupUtility, TestEnvironmentCleaner } from './test_cleanup_utility.js';
import { IsolatedTestEnvironment } from './test_isolated_environments.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export class BaseTestClass {
    constructor(testName = 'BaseTest') {
        this.testName = testName;
        this.testId = `${testName}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.cleanupUtility = new TestCleanupUtility();
        this.resources = new Map(); // Track test-specific resources
        this.startTime = Date.now();
    }

    /**
     * Setup method - override in derived classes
     */
    async setup() {
        console.log(`\n🚀 Setting up test: ${this.testName}`);
        
        // Create isolated test directory
        this.testDir = await this.createTestDirectory();
        
        // Initialize any shared resources
        await this.initializeResources();
    }

    /**
     * Teardown method - always call super.teardown() in overrides
     */
    async teardown() {
        console.log(`\n🧹 Tearing down test: ${this.testName}`);
        
        try {
            // Clean up all registered resources
            const results = await this.cleanupUtility.cleanupAll({ silent: false });
            
            // Clean up test directory
            if (this.testDir) {
                await this.cleanupUtility.cleanupDirectory(this.testDir);
            }
            
            // Report test duration
            const duration = (Date.now() - this.startTime) / 1000;
            console.log(`⏱️  Test completed in ${duration.toFixed(2)}s`);
            
            return results;
        } catch (error) {
            console.error(`❌ Teardown error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create isolated test directory
     */
    async createTestDirectory() {
        const baseDir = path.join(os.tmpdir(), 'tmux-claude-tests');
        const testDir = path.join(baseDir, this.testId);
        
        await fs.mkdir(testDir, { recursive: true });
        this.cleanupUtility.registerResource('directory', this.testId, { path: testDir });
        
        return testDir;
    }

    /**
     * Initialize shared resources - override in derived classes
     */
    async initializeResources() {
        // Override in derived classes
    }

    /**
     * Create a subdirectory within the test directory
     */
    async createSubdirectory(name) {
        const subdir = path.join(this.testDir, name);
        await fs.mkdir(subdir, { recursive: true });
        return subdir;
    }

    /**
     * Create a temporary file
     */
    async createTempFile(name, content = '') {
        const filepath = path.join(this.testDir, name);
        await fs.mkdir(path.dirname(filepath), { recursive: true });
        await fs.writeFile(filepath, content);
        this.cleanupUtility.registerResource('file', name, { path: filepath });
        return filepath;
    }

    /**
     * Register a tmux session for cleanup
     */
    registerTmuxSession(sessionName) {
        this.cleanupUtility.registerResource('tmux', sessionName);
    }

    /**
     * Register a git worktree for cleanup
     */
    registerGitWorktree(worktreeName, repoPath) {
        this.cleanupUtility.registerResource('git-worktree', worktreeName, { repoPath });
    }

    /**
     * Run test with automatic setup/teardown
     */
    async run(testFn) {
        try {
            await this.setup();
            // Bind test function to this instance
            const result = await testFn.call(this);
            return { success: true, result };
        } catch (error) {
            console.error(`❌ Test failed: ${error.message}`);
            if (error.stack) {
                console.error(error.stack);
            }
            return { success: false, error: error.message };
        } finally {
            await this.teardown();
        }
    }

    /**
     * Assert helper with detailed error messages
     */
    assert(condition, message) {
        if (!condition) {
            const error = new Error(`Assertion failed: ${message}`);
            error.name = 'AssertionError';
            throw error;
        }
    }

    /**
     * Assert equality with detailed comparison
     */
    assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`Assertion failed: ${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
        }
    }

    /**
     * Wait for condition with timeout
     */
    async waitFor(conditionFn, options = {}) {
        const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await conditionFn()) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error(`Timeout waiting for condition: ${message}`);
    }

    /**
     * Sleep helper
     */
    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Integration Test Base Class
 * Adds integration-specific functionality
 */
export class IntegrationTestBase extends BaseTestClass {
    constructor(testName = 'IntegrationTest') {
        super(testName);
        this.isolatedEnv = null;
        this.instanceManager = null;
    }

    async setup() {
        await super.setup();
        
        // Create isolated environment for integration tests
        this.isolatedEnv = new IsolatedTestEnvironment();
        const env = await this.isolatedEnv.create({
            initGit: true,
            cleanup: false // We'll handle cleanup
        });
        
        this.envDir = env.baseDir;
        this.cleanupUtility.registerResource('directory', 'isolated-env', { path: this.envDir });
    }

    async teardown() {
        // Clean up isolated environment
        if (this.isolatedEnv) {
            await this.isolatedEnv.destroy();
        }
        
        await super.teardown();
    }

    /**
     * Create instance manager for tests
     */
    async createInstanceManager() {
        const { InstanceManager } = await import('../src/instance_manager.js');
        const stateDir = await this.createSubdirectory('state');
        this.instanceManager = new InstanceManager(stateDir);
        return this.instanceManager;
    }

    /**
     * Execute command in isolated environment
     */
    async execInEnv(command, options = {}) {
        if (!this.isolatedEnv) {
            throw new Error('Isolated environment not initialized');
        }
        return this.isolatedEnv.exec(command, options);
    }
}

/**
 * Unit Test Base Class
 * Adds unit-specific functionality with mocking support
 */
export class UnitTestBase extends BaseTestClass {
    constructor(testName = 'UnitTest') {
        super(testName);
        this.mocks = new Map();
        this.originalFunctions = new Map();
    }

    /**
     * Mock a function or method
     */
    mock(object, methodName, mockImplementation) {
        const key = `${object.constructor.name}.${methodName}`;
        
        // Store original function
        if (!this.originalFunctions.has(key)) {
            this.originalFunctions.set(key, object[methodName]);
        }
        
        // Apply mock
        object[methodName] = mockImplementation;
        this.mocks.set(key, { object, methodName });
    }

    /**
     * Restore all mocks
     */
    restoreMocks() {
        for (const [key, { object, methodName }] of this.mocks.entries()) {
            if (this.originalFunctions.has(key)) {
                object[methodName] = this.originalFunctions.get(key);
            }
        }
        this.mocks.clear();
        this.originalFunctions.clear();
    }

    async teardown() {
        // Restore all mocks
        this.restoreMocks();
        
        await super.teardown();
    }
}

/**
 * Test Suite Runner
 * Runs multiple tests with aggregated results
 */
export class TestSuiteRunner {
    constructor(suiteName = 'Test Suite') {
        this.suiteName = suiteName;
        this.tests = [];
        this.results = [];
        this.envCleaner = new TestEnvironmentCleaner();
    }

    /**
     * Add a test to the suite
     */
    addTest(name, testClass, testFn) {
        this.tests.push({ name, testClass, testFn });
    }

    /**
     * Run all tests in the suite
     */
    async run() {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🧪 Running Test Suite: ${this.suiteName}`);
        console.log(`${'='.repeat(60)}`);

        // Clean environment before starting
        await this.envCleaner.cleanupTestEnvironment();

        for (const { name, testClass, testFn } of this.tests) {
            const test = new testClass(name);
            const result = await test.run(testFn);
            
            this.results.push({
                name,
                ...result
            });
        }

        // Print summary
        this.printSummary();

        // Clean environment after tests
        await this.envCleaner.cleanupTestEnvironment();

        return this.results;
    }

    /**
     * Print test results summary
     */
    printSummary() {
        console.log(`\n${'='.repeat(60)}`);
        console.log('📊 Test Results Summary');
        console.log(`${'='.repeat(60)}`);

        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;

        console.log(`Total Tests: ${this.results.length}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);

        if (failed > 0) {
            console.log('\nFailed Tests:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        }

        console.log(`${'='.repeat(60)}\n`);
    }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Testing Base Test Classes\n');

    const suite = new TestSuiteRunner('Base Test Classes');

    // Test 1: Basic test functionality
    suite.addTest('Basic Test', BaseTestClass, async function() {
        this.assert(true, 'True should be true');
        this.assertEqual(1 + 1, 2, 'Math should work');
        
        const file = await this.createTempFile('test.txt', 'Hello World');
        const content = await fs.readFile(file, 'utf-8');
        this.assertEqual(content, 'Hello World', 'File content should match');
    });

    // Test 2: Integration test functionality
    suite.addTest('Integration Test', IntegrationTestBase, async function() {
        const { stdout } = await this.execInEnv('echo "Hello from isolated env"');
        this.assert(stdout.includes('Hello from isolated env'), 'Command should execute in isolated env');
    });

    // Test 3: Unit test mocking
    suite.addTest('Unit Test Mocking', UnitTestBase, async function() {
        const obj = {
            getValue: () => 'original'
        };

        this.assertEqual(obj.getValue(), 'original', 'Original function should work');

        this.mock(obj, 'getValue', () => 'mocked');
        this.assertEqual(obj.getValue(), 'mocked', 'Mock should be applied');

        this.restoreMocks();
        this.assertEqual(obj.getValue(), 'original', 'Original should be restored');
    });

    // Run the suite
    await suite.run();
}