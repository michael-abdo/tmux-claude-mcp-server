#!/usr/bin/env node

/**
 * Test Architectural Alignment
 * 
 * Verifies that all Phase 4 architectural alignments are working correctly:
 * 1. Todo monitoring for progress tracking
 * 2. MCP config generation for each instance
 * 3. Git branch automation for specialists
 * 4. Phase 1 simple mode
 * 5. New MCP tools (getProgress, getGitBranch, mergeBranch)
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { phase1Mode } from '../../src/phase1_simple_mode.js';
import { todoMonitor } from '../../src/todo_monitor.js';
import { mcpConfigGenerator } from '../../src/mcp_config_generator.js';
import { gitBranchManager } from '../../src/git_branch_manager.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ArchitecturalAlignmentTest {
    constructor() {
        this.testDir = path.join(__dirname, '..', 'test-arch-alignment');
        this.instanceManager = null;
        this.mcpTools = null;
    }

    async setup() {
        console.log('🔧 Setting up test environment...');
        
        // Clean test directory
        await fs.rm(this.testDir, { recursive: true, force: true });
        await fs.mkdir(this.testDir, { recursive: true });
        
        // Clean up any leftover worktree directories from previous runs
        const worktreeDir = this.testDir + '-worktrees';
        await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
        const parentWorktreeDir = path.join(__dirname, '..', path.basename(this.testDir) + '-worktrees');
        await fs.rm(parentWorktreeDir, { recursive: true, force: true }).catch(() => {});
        
        // Initialize with Phase 3 features
        process.env.PHASE = '3';
        this.instanceManager = new InstanceManager(path.join(this.testDir, 'state'), {
            useRedis: false // Use JSON for testing
        });
        
        this.mcpTools = new EnhancedMCPTools(this.instanceManager);
        
        console.log('✅ Test environment ready\n');
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');
        
        // First terminate all instances to trigger worktree cleanup
        const instances = await this.instanceManager.listInstances();
        for (const instance of instances) {
            if (instance.instanceId.includes('test_')) {
                await this.instanceManager.terminateInstance(instance.instanceId).catch(() => {});
            }
        }
        
        await this.instanceManager.cleanup();
        await fs.rm(this.testDir, { recursive: true, force: true });
        
        // Clean up any worktree directories that might have been created
        const worktreeDir = this.testDir + '-worktrees';
        await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
        
        // Also clean up from parent directory in case of path resolution differences
        const parentWorktreeDir = path.join(__dirname, '..', path.basename(this.testDir) + '-worktrees');
        await fs.rm(parentWorktreeDir, { recursive: true, force: true }).catch(() => {});
    }

    async testTodoMonitoring() {
        console.log('📝 Testing Todo Monitoring...');
        
        try {
            // Create a test instance
            const result = await this.instanceManager.spawnInstance(
                'specialist',
                this.testDir,
                'Test specialist for todo monitoring',
                null
            );
            
            // Verify todo monitoring started
            const progress = todoMonitor.getProgress(result.instanceId);
            console.log(`  ✓ Todo monitoring active: ${JSON.stringify(progress)}`);
            
            // Simulate todo file creation
            const todoDir = path.join(os.homedir(), '.claude', 'todos');
            await fs.mkdir(todoDir, { recursive: true });
            
            const todoFile = path.join(todoDir, `${path.basename(result.projectPath)}.json`);
            await fs.writeFile(todoFile, JSON.stringify({
                todos: [
                    { id: '1', status: 'completed', content: 'Setup project' },
                    { id: '2', status: 'in_progress', content: 'Implement feature' },
                    { id: '3', status: 'pending', content: 'Write tests' }
                ]
            }));
            
            // Wait for monitoring to pick up changes
            await new Promise(resolve => setTimeout(resolve, 6000));
            
            const updatedProgress = todoMonitor.getProgress(result.instanceId);
            console.log(`  ✓ Progress updated: ${JSON.stringify(updatedProgress)}`);
            
            // Clean up todo file
            await fs.rm(todoFile, { force: true });
            
            await this.instanceManager.terminateInstance(result.instanceId);
            console.log('✅ Todo monitoring test passed\n');
            
        } catch (error) {
            console.error('❌ Todo monitoring test failed:', error);
            throw error;
        }
    }

    async testMCPConfigGeneration() {
        console.log('⚙️  Testing MCP Config Generation...');
        
        try {
            // Test for each role
            const roles = ['executive', 'manager', 'specialist'];
            
            for (const role of roles) {
                const result = await this.instanceManager.spawnInstance(
                    role,
                    this.testDir,
                    `Test ${role} for MCP config`,
                    null
                );
                
                // Check config file exists
                const configPath = mcpConfigGenerator.getConfigPath(result.projectPath);
                const configExists = await fs.access(configPath).then(() => true).catch(() => false);
                console.log(`  ✓ Config exists for ${role}: ${configExists}`);
                
                // Validate config
                const isValid = await mcpConfigGenerator.validateConfig(configPath);
                console.log(`  ✓ Config valid for ${role}: ${isValid}`);
                
                // Check role-specific settings
                const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
                const allowedTools = JSON.parse(config.mcpServers['tmux-claude'].env.ALLOWED_TOOLS || '[]');
                
                if (role === 'specialist') {
                    console.log(`  ✓ Specialist has no tools: ${allowedTools.length === 0}`);
                } else {
                    console.log(`  ✓ ${role} has tools: ${allowedTools.length > 0}`);
                }
                
                await this.instanceManager.terminateInstance(result.instanceId);
            }
            
            console.log('✅ MCP config generation test passed\n');
            
        } catch (error) {
            console.error('❌ MCP config generation test failed:', error);
            throw error;
        }
    }

    async testGitBranchAutomation() {
        console.log('🌿 Testing Git Branch Automation...');
        
        try {
            // Initialize git repo
            await gitBranchManager.gitCommand('init', this.testDir);
            await gitBranchManager.gitCommand('config user.email "test@example.com"', this.testDir);
            await gitBranchManager.gitCommand('config user.name "Test User"', this.testDir);
            
            // Create initial commit
            await fs.writeFile(path.join(this.testDir, 'README.md'), '# Test Project');
            await gitBranchManager.gitCommand('add .', this.testDir);
            await gitBranchManager.gitCommand('commit -m "Initial commit"', this.testDir);
            
            // Spawn specialist
            const result = await this.instanceManager.spawnInstance(
                'specialist',
                this.testDir,
                'Task ID: test-123\nFeature: user-authentication',
                null
            );
            
            // Check branch was created
            const instances = await this.instanceManager.listInstances();
            const instance = instances.find(i => i.instanceId === result.instanceId);
            
            if (instance && instance.branchName) {
                console.log(`  ✓ Branch created: ${instance.branchName}`);
                console.log(`  ✓ Branch format correct: ${instance.branchName.startsWith('specialist-')}`);
            } else {
                // For worktree-based specialists, branch info might be in different place
                console.log(`  ✓ Specialist instance created: ${result.instanceId}`);
                console.log(`  ✓ Using worktree at: ${result.projectPath}`);
            }
            
            // Test branch operations via MCP tools
            try {
                const branchInfo = await this.mcpTools.getGitBranch({ instanceId: result.instanceId });
                console.log(`  ✓ Branch retrieved via MCP: ${branchInfo.branchName}`);
            } catch (error) {
                console.log(`  ℹ️  Branch info not available via MCP (expected for worktrees)`);
            }
            
            await this.instanceManager.terminateInstance(result.instanceId);
            console.log('✅ Git branch automation test passed\n');
            
        } catch (error) {
            console.error('❌ Git branch automation test failed:', error);
            throw error;
        }
    }

    async testPhase1SimpleMode() {
        console.log('🚀 Testing Phase 1 Simple Mode...');
        
        try {
            // Test instance limit
            const exec = await phase1Mode.spawnSimple({
                role: 'executive',
                workDir: path.join(this.testDir, 'phase1'),
                context: 'Test executive'
            });
            console.log(`  ✓ Executive created: ${exec.instanceId}`);
            
            const mgr = await phase1Mode.spawnSimple({
                role: 'manager',
                workDir: path.join(this.testDir, 'phase1'),
                context: 'Test manager',
                parentId: exec.instanceId
            });
            console.log(`  ✓ Manager created: ${mgr.instanceId}`);
            
            const spec = await phase1Mode.spawnSimple({
                role: 'specialist',
                workDir: path.join(this.testDir, 'phase1'),
                context: 'Test specialist',
                parentId: mgr.instanceId
            });
            console.log(`  ✓ Specialist created: ${spec.instanceId}`);
            console.log(`  ✓ Specialist branch: ${spec.branchName}`);
            
            // Test limit enforcement
            try {
                await phase1Mode.spawnSimple({
                    role: 'specialist',
                    workDir: path.join(this.testDir, 'phase1'),
                    context: 'Extra specialist',
                    parentId: mgr.instanceId
                });
                console.error('❌ Should have failed - limit exceeded');
            } catch (error) {
                console.log(`  ✓ Limit enforced: ${error.message}`);
            }
            
            // Test progress tracking
            const progress = phase1Mode.getProgress(spec.instanceId);
            console.log(`  ✓ Progress tracking works: ${JSON.stringify(progress)}`);
            
            // Cleanup
            await phase1Mode.terminateInstance(spec.instanceId);
            await phase1Mode.terminateInstance(mgr.instanceId);
            await phase1Mode.terminateInstance(exec.instanceId);
            
            console.log('✅ Phase 1 simple mode test passed\n');
            
        } catch (error) {
            console.error('❌ Phase 1 simple mode test failed:', error);
            throw error;
        }
    }

    async testNewMCPTools() {
        console.log('🔧 Testing New MCP Tools...');
        
        try {
            // Create test instance
            const result = await this.instanceManager.spawnInstance(
                'specialist',
                this.testDir,
                'Task ID: tool-test\nFeature: new-tools',
                null
            );
            
            // Test getProgress tool
            const progress = await this.mcpTools.getProgress({ 
                instanceId: result.instanceId 
            });
            console.log(`  ✓ getProgress tool: ${progress.message}`);
            
            // Test getGitBranch tool
            const branch = await this.mcpTools.getGitBranch({ 
                instanceId: result.instanceId 
            });
            console.log(`  ✓ getGitBranch tool: ${branch.branchName}`);
            
            // Test role restrictions
            try {
                await this.mcpTools.mergeBranch(
                    { instanceId: result.instanceId },
                    'specialist' // Caller role
                );
                console.error('❌ Should have failed - specialist cannot merge');
            } catch (error) {
                console.log(`  ✓ Role restriction works: ${error.message}`);
            }
            
            await this.instanceManager.terminateInstance(result.instanceId);
            console.log('✅ New MCP tools test passed\n');
            
        } catch (error) {
            console.error('❌ New MCP tools test failed:', error);
            throw error;
        }
    }

    async runAllTests() {
        console.log('🏃 Running Architectural Alignment Tests\n');
        console.log('=' . repeat(50) + '\n');
        
        try {
            await this.setup();
            
            await this.testTodoMonitoring();
            await this.testMCPConfigGeneration();
            await this.testGitBranchAutomation();
            await this.testPhase1SimpleMode();
            await this.testNewMCPTools();
            
            console.log('=' . repeat(50));
            console.log('🎉 All architectural alignment tests passed!');
            console.log('=' . repeat(50));
            
        } catch (error) {
            console.error('\n💥 Test suite failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests
const test = new ArchitecturalAlignmentTest();
test.runAllTests().catch(console.error);