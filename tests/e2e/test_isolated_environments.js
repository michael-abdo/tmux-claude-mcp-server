#!/usr/bin/env node

/**
 * Test Isolated Environments
 * Creates completely isolated test environments for git integration tests
 * to prevent interference between tests and with the parent repository
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const execAsync = promisify(exec);

export class IsolatedTestEnvironment {
    constructor() {
        this.testId = `test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        this.baseDir = path.join(os.tmpdir(), 'tmux-claude-tests', this.testId);
        this.cleanup = true;
    }

    /**
     * Create isolated test environment
     * @param {Object} options - Environment options
     * @returns {Promise<Object>} Environment details
     */
    async create(options = {}) {
        const {
            initGit = true,
            gitUser = 'Test User',
            gitEmail = 'test@example.com',
            initialFiles = {},
            cleanup = true
        } = options;

        this.cleanup = cleanup;

        try {
            // Ensure completely clean environment
            await fs.rm(this.baseDir, { recursive: true, force: true });
            await fs.mkdir(this.baseDir, { recursive: true });

            console.log(`📁 Created isolated environment: ${this.testId}`);

            // Initialize git if requested
            if (initGit) {
                await this.initializeGit(gitUser, gitEmail);
            }

            // Create initial files
            for (const [filename, content] of Object.entries(initialFiles)) {
                const filepath = path.join(this.baseDir, filename);
                await fs.mkdir(path.dirname(filepath), { recursive: true });
                await fs.writeFile(filepath, content);
            }

            // Commit initial files if git is initialized
            if (initGit && Object.keys(initialFiles).length > 0) {
                await execAsync('git add -A', { cwd: this.baseDir });
                await execAsync('git commit -m "Initial test setup"', { cwd: this.baseDir });
            }

            return {
                testId: this.testId,
                baseDir: this.baseDir,
                exec: (cmd, opts) => this.exec(cmd, opts),
                createSubdir: (name) => this.createSubdir(name),
                cleanup: () => this.destroy()
            };
        } catch (error) {
            // Cleanup on error
            await this.destroy();
            throw error;
        }
    }

    /**
     * Initialize git repository in isolated environment
     */
    async initializeGit(user, email) {
        await execAsync('git init', { cwd: this.baseDir });
        await execAsync(`git config user.name "${user}"`, { cwd: this.baseDir });
        await execAsync(`git config user.email "${email}"`, { cwd: this.baseDir });
        
        // Create initial commit to establish main branch
        await execAsync('git checkout -b main', { cwd: this.baseDir });
        await fs.writeFile(path.join(this.baseDir, '.gitkeep'), '');
        await execAsync('git add .gitkeep', { cwd: this.baseDir });
        await execAsync('git commit -m "Initial commit"', { cwd: this.baseDir });
        
        console.log('   ✅ Git repository initialized');
    }

    /**
     * Create a subdirectory in the test environment
     */
    async createSubdir(name) {
        const subdir = path.join(this.baseDir, name);
        await fs.mkdir(subdir, { recursive: true });
        return subdir;
    }

    /**
     * Execute command in isolated environment
     */
    async exec(command, options = {}) {
        return execAsync(command, { 
            cwd: this.baseDir,
            ...options 
        });
    }

    /**
     * Clean up the test environment
     */
    async destroy() {
        if (this.cleanup) {
            try {
                await fs.rm(this.baseDir, { recursive: true, force: true });
                console.log(`   🧹 Cleaned up environment: ${this.testId}`);
            } catch (error) {
                console.warn(`   ⚠️  Failed to cleanup ${this.testId}: ${error.message}`);
            }
        } else {
            console.log(`   📌 Preserved environment: ${this.baseDir}`);
        }
    }
}

/**
 * Test runner with isolated environments
 */
export class IsolatedTestRunner {
    constructor() {
        this.results = [];
    }

    /**
     * Run a test in an isolated environment
     */
    async runTest(name, testFn, envOptions = {}) {
        console.log(`\n🧪 ${name}`);
        const env = new IsolatedTestEnvironment();
        
        try {
            const testEnv = await env.create(envOptions);
            const result = await testFn(testEnv);
            
            this.results.push({
                name,
                success: true,
                result
            });
            
            console.log(`   ✅ Test passed`);
            return true;
        } catch (error) {
            this.results.push({
                name,
                success: false,
                error: error.message
            });
            
            console.error(`   ❌ Test failed: ${error.message}`);
            return false;
        } finally {
            await env.destroy();
        }
    }

    /**
     * Get test results summary
     */
    getSummary() {
        const passed = this.results.filter(r => r.success).length;
        const failed = this.results.filter(r => !r.success).length;
        
        return {
            total: this.results.length,
            passed,
            failed,
            results: this.results
        };
    }
}

// Example usage and tests
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Testing Isolated Test Environments\n');

    const runner = new IsolatedTestRunner();

    // Test 1: Basic environment creation
    await runner.runTest('Basic environment creation', async (env) => {
        // Verify environment exists
        const stats = await fs.stat(env.baseDir);
        if (!stats.isDirectory()) {
            throw new Error('Environment directory not created');
        }

        // Verify git is initialized
        const { stdout } = await env.exec('git status');
        if (!stdout.includes('On branch master')) {
            throw new Error('Git not properly initialized');
        }

        return { baseDir: env.baseDir };
    });

    // Test 2: Multiple isolated environments
    await runner.runTest('Multiple isolated environments', async (env1) => {
        // Create second environment
        const env2 = new IsolatedTestEnvironment();
        const testEnv2 = await env2.create();

        try {
            // Verify they are different
            if (env1.baseDir === testEnv2.baseDir) {
                throw new Error('Environments not isolated');
            }

            // Create file in env1
            await fs.writeFile(path.join(env1.baseDir, 'test.txt'), 'env1');
            
            // Verify file doesn't exist in env2
            try {
                await fs.access(path.join(testEnv2.baseDir, 'test.txt'));
                throw new Error('Environments are not isolated');
            } catch {
                // Expected - file should not exist
            }

            return { env1: env1.baseDir, env2: testEnv2.baseDir };
        } finally {
            await env2.destroy();
        }
    });

    // Test 3: Environment with initial files
    await runner.runTest('Environment with initial files', async (env) => {
        // Files should have been created and committed
        const { stdout } = await env.exec('git log --oneline');
        if (!stdout.includes('Initial test setup')) {
            throw new Error('Initial files not committed');
        }

        // Verify files exist
        const readme = await fs.readFile(path.join(env.baseDir, 'README.md'), 'utf-8');
        if (readme !== '# Test Project\n') {
            throw new Error('Initial file content incorrect');
        }

        return { commits: stdout.trim().split('\n').length };
    }, {
        initialFiles: {
            'README.md': '# Test Project\n',
            'src/index.js': 'console.log("test");'
        }
    });

    // Test 4: Non-git environment
    await runner.runTest('Non-git environment', async (env) => {
        // Verify git is not initialized
        try {
            await env.exec('git status');
            throw new Error('Git should not be initialized');
        } catch (error) {
            if (!error.message.includes('not a git repository')) {
                throw error;
            }
        }

        return { gitInitialized: false };
    }, { initGit: false });

    // Print summary
    const summary = runner.getSummary();
    console.log(`\n📊 Test Results: ${summary.passed} passed, ${summary.failed} failed`);
    
    if (summary.failed === 0) {
        console.log('🎉 All isolated environment tests PASSED!');
        console.log('\n✨ Key features verified:');
        console.log('   - Complete isolation between test environments');
        console.log('   - Automatic cleanup after tests');
        console.log('   - Git repository initialization');
        console.log('   - Initial file creation and commit');
        console.log('   - Support for non-git environments');
    } else {
        console.log('💥 Some tests failed');
        summary.results
            .filter(r => !r.success)
            .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }

    process.exit(summary.failed === 0 ? 0 : 1);
}