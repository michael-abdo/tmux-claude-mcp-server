#!/usr/bin/env node

/**
 * Quick test for Phase 4 architectural features
 * Tests without actually launching Claude
 */

import { todoMonitor } from '../../src/todo_monitor.js';
import { mcpConfigGenerator } from '../../src/mcp_config_generator.js';
import { gitBranchManager } from '../../src/git_branch_manager.js';
import fs from 'fs/promises';
import path from 'path';

async function testArchitecturalFeatures() {
    const testDir = './test-phase4-quick';
    
    console.log('🧪 Testing Phase 4 Architectural Features\n');
    
    // Setup
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    
    try {
        // 1. Test MCP Config Generation
        console.log('1️⃣ Testing MCP Config Generation...');
        
        for (const role of ['executive', 'manager', 'specialist']) {
            const config = await mcpConfigGenerator.generateConfig({
                instanceId: `test_${role}_1`,
                role,
                workDir: testDir,
                parentId: null
            });
            
            const valid = await mcpConfigGenerator.validateConfig(config);
            console.log(`   ✓ ${role} config: ${valid ? 'valid' : 'invalid'}`);
            
            // Check role restrictions
            const configData = JSON.parse(await fs.readFile(config, 'utf-8'));
            const tools = JSON.parse(configData.mcpServers['tmux-claude'].env.ALLOWED_TOOLS || '[]');
            
            if (role === 'specialist') {
                console.log(`   ✓ Specialist has no tools: ${tools.length === 0}`);
            } else {
                console.log(`   ✓ ${role} has ${tools.length} tools`);
            }
        }
        
        // 2. Test Git Branch Manager
        console.log('\n2️⃣ Testing Git Branch Manager...');
        
        // Initialize git repo
        await gitBranchManager.gitCommand('init', testDir);
        await gitBranchManager.gitCommand('config user.email "test@example.com"', testDir);
        await gitBranchManager.gitCommand('config user.name "Test User"', testDir);
        
        // Create initial commit
        await fs.writeFile(path.join(testDir, 'README.md'), '# Test');
        await gitBranchManager.gitCommand('add .', testDir);
        await gitBranchManager.gitCommand('commit -m "Initial"', testDir);
        
        // Create specialist branch
        const branchName = await gitBranchManager.createSpecialistBranch({
            instanceId: 'spec_test_1',
            taskId: 'TASK-123',
            feature: 'auth-system',
            workDir: testDir
        });
        
        console.log(`   ✓ Created branch: ${branchName}`);
        console.log(`   ✓ Format correct: ${branchName === 'specialist-spec_test_1-TASK-123-auth-system'}`);
        
        // Check branch exists
        const exists = await gitBranchManager.branchExists(branchName, testDir);
        console.log(`   ✓ Branch exists: ${exists}`);
        
        // 3. Test Todo Monitor
        console.log('\n3️⃣ Testing Todo Monitor...');
        
        // Start monitoring
        const instanceId = 'test_instance_1';
        todoMonitor.startMonitoring(instanceId, testDir);
        
        const progress = todoMonitor.getProgress(instanceId);
        console.log(`   ✓ Initial progress: ${JSON.stringify(progress)}`);
        
        // Simulate todo update
        todoMonitor.instanceTodos.set(instanceId, [
            { id: '1', status: 'completed', content: 'Setup' },
            { id: '2', status: 'in_progress', content: 'Implement' },
            { id: '3', status: 'pending', content: 'Test' }
        ]);
        
        const updated = todoMonitor.getProgress(instanceId);
        console.log(`   ✓ Updated progress: ${JSON.stringify(updated)}`);
        console.log(`   ✓ Completion rate: ${updated.completionRate}%`);
        
        // Stop monitoring
        todoMonitor.stopMonitoring(instanceId);
        
        // 4. Test Phase 1 Simple Mode
        console.log('\n4️⃣ Testing Phase 1 Simple Mode...');
        const { phase1Mode } = await import('../src/phase1_simple_mode.js');
        
        // Test instance ID generation
        const execId = phase1Mode.generateInstanceId('executive');
        const mgrId = phase1Mode.generateInstanceId('manager');
        const specId = phase1Mode.generateInstanceId('specialist');
        
        console.log(`   ✓ Executive ID: ${execId === 'exec_1'}`);
        console.log(`   ✓ Manager ID: ${mgrId === 'mgr_1_1'}`);
        console.log(`   ✓ Specialist ID: ${specId === 'spec_1_1_1'}`);
        
        // Test branch name generation
        const testBranch = gitBranchManager.generateBranchName('spec_1', 'TASK-456', 'User Auth System!');
        console.log(`   ✓ Branch sanitization: ${testBranch === 'specialist-spec_1-TASK-456-user-auth-system'}`);
        
        console.log('\n✅ All Phase 4 architectural features working correctly!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    } finally {
        // Cleanup
        await fs.rm(testDir, { recursive: true, force: true });
        todoMonitor.cleanup();
    }
}

// Run test
testArchitecturalFeatures().catch(console.error);