#!/usr/bin/env node

/**
 * Unit Tests for Git Manager
 * Tests git operations with mocked commands for fast, reliable testing
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GitBranchManager } from '../../src/git_branch_manager.js';
import { SharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';

// Mock git command execution
class MockGitManager extends GitBranchManager {
    constructor() {
        super();
        this.commandHistory = [];
        this.mockResponses = new Map();
    }
    
    // Override gitCommand to use mocks
    async gitCommand(command, workDir) {
        this.commandHistory.push({ command, workDir });
        
        // Check for mock response
        const mockKey = `${command}|${workDir}`;
        if (this.mockResponses.has(mockKey)) {
            const response = this.mockResponses.get(mockKey);
            if (response.error) {
                throw new Error(response.error);
            }
            return response;
        }
        
        // Default responses for common commands
        if (command === 'status --porcelain') {
            return { stdout: '', stderr: '' };
        }
        if (command === 'rev-parse --abbrev-ref HEAD') {
            return { stdout: 'master\n', stderr: '' };
        }
        if (command.startsWith('branch')) {
            return { stdout: '* master\n', stderr: '' };
        }
        if (command === 'rev-parse --git-dir') {
            return { stdout: '.git\n', stderr: '' };
        }
        
        return { stdout: '', stderr: '' };
    }
    
    // Set mock response for a specific command
    setMockResponse(command, workDir, response) {
        const mockKey = `${command}|${workDir}`;
        this.mockResponses.set(mockKey, response);
    }
    
    // Get command history
    getCommandHistory() {
        return this.commandHistory;
    }
    
    // Clear history and mocks
    reset() {
        this.commandHistory = [];
        this.mockResponses.clear();
    }
}

// Mock SharedWorkspaceGitManager
class MockSharedWorkspaceGitManager extends SharedWorkspaceGitManager {
    constructor() {
        super();
        this.mockGit = new MockGitManager();
    }
    
    async gitCommand(command, workDir) {
        return this.mockGit.gitCommand(command, workDir);
    }
    
    // Override branchExists to use mock
    async branchExists(branch, workDir) {
        try {
            const result = await this.gitCommand(`rev-parse --verify ${branch}`, workDir);
            return result.stdout.trim().length > 0;
        } catch {
            return false;
        }
    }
    
    setMockResponse(command, workDir, response) {
        this.mockGit.setMockResponse(command, workDir, response);
    }
    
    getCommandHistory() {
        return this.mockGit.getCommandHistory();
    }
    
    reset() {
        this.mockGit.reset();
    }
}

// Test suite
test('Git Status Parsing', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    
    await t.test('parses clean status correctly', () => {
        const status = '';
        const result = manager.parseGitStatus(status);
        assert.deepEqual(result, []);
    });
    
    await t.test('parses modified files correctly', () => {
        const status = ' M src/file.js\n?? new-file.txt\nA  staged.js';
        const result = manager.parseGitStatus(status);
        
        assert.equal(result.length, 3);
        assert.equal(result[0].filename, 'src/file.js');
        assert.equal(result[0].staged, false);
        assert.equal(result[0].unstaged, true);
        
        assert.equal(result[1].filename, 'new-file.txt');
        assert.equal(result[1].isNew, true);
        
        assert.equal(result[2].filename, 'staged.js');
        assert.equal(result[2].staged, true);
    });
    
    await t.test('handles empty lines correctly', () => {
        const status = ' M file1.js\n\n M file2.js\n';
        const result = manager.parseGitStatus(status);
        assert.equal(result.length, 2);
    });
});

test('Workspace File Detection', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    
    await t.test('detects .claude directory files', () => {
        assert.equal(manager.isWorkspaceGeneratedFile('.claude/settings.json'), true);
        assert.equal(manager.isWorkspaceGeneratedFile('.claude/'), true);
        assert.equal(manager.isWorkspaceGeneratedFile('.claude/subdir/file.txt'), true);
    });
    
    await t.test('detects workspace marker file', () => {
        assert.equal(manager.isWorkspaceGeneratedFile('SHARED_WORKSPACE.md'), true);
    });
    
    await t.test('detects .managers directory', () => {
        assert.equal(manager.isWorkspaceGeneratedFile('.managers/'), true);
        assert.equal(manager.isWorkspaceGeneratedFile('.managers/mgr_001/file.md'), true);
    });
    
    await t.test('detects .gitattributes', () => {
        assert.equal(manager.isWorkspaceGeneratedFile('.gitattributes'), true);
    });
    
    await t.test('does not detect regular files', () => {
        assert.equal(manager.isWorkspaceGeneratedFile('src/index.js'), false);
        assert.equal(manager.isWorkspaceGeneratedFile('README.md'), false);
        assert.equal(manager.isWorkspaceGeneratedFile('package.json'), false);
    });
});

test('Clean Working Tree Handling', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    const workDir = '/test/workspace';
    
    await t.test('passes with clean working tree', async () => {
        manager.setMockResponse('status --porcelain', workDir, { stdout: '', stderr: '' });
        
        await assert.doesNotReject(
            manager.ensureCleanWorkingTree(workDir)
        );
    });
    
    await t.test('auto-commits workspace files', async () => {
        manager.reset();
        manager.setMockResponse('status --porcelain', workDir, {
            stdout: '?? .claude/settings.json\n?? SHARED_WORKSPACE.md',
            stderr: ''
        });
        
        await manager.ensureCleanWorkingTree(workDir);
        
        const history = manager.getCommandHistory();
        // Should have: status, add, commit
        assert.equal(history.length >= 3, true);
        assert.equal(history.some(h => h.command.includes('add')), true);
        assert.equal(history.some(h => h.command.includes('commit')), true);
    });
    
    await t.test('throws on non-workspace files', async () => {
        manager.reset();
        manager.setMockResponse('status --porcelain', workDir, {
            stdout: ' M src/index.js\n?? .claude/settings.json',
            stderr: ''
        });
        
        await assert.rejects(
            manager.ensureCleanWorkingTree(workDir),
            /Working tree has uncommitted changes/
        );
    });
});

test('Branch Operations', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    const workDir = '/test/workspace';
    
    await t.test('checks branch existence', async () => {
        manager.setMockResponse('rev-parse --verify test-branch', workDir, {
            stdout: 'abc123',
            stderr: ''
        });
        
        const exists = await manager.branchExists('test-branch', workDir);
        assert.equal(exists, true);
    });
    
    await t.test('generates manager branch names', () => {
        const branchName = manager.generateManagerBranchName('mgr_001');
        assert.equal(branchName, 'manager-mgr_001');
    });
    
    await t.test('gets current branch', async () => {
        manager.setMockResponse('rev-parse --abbrev-ref HEAD', workDir, {
            stdout: 'feature-branch\n',
            stderr: ''
        });
        
        const branch = await manager.getCurrentBranch(workDir);
        assert.equal(branch, 'feature-branch');
    });
});

test('Default Branch Detection', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    const workDir = '/test/workspace';
    
    await t.test('detects from remote HEAD', async () => {
        manager.reset();
        manager.setMockResponse('symbolic-ref refs/remotes/origin/HEAD', workDir, {
            stdout: 'refs/remotes/origin/main\n',
            stderr: ''
        });
        
        const branch = await manager.getDefaultBranch(workDir);
        assert.equal(branch, 'main');
    });
    
    await t.test('falls back to main if exists', async () => {
        manager.reset();
        manager.setMockResponse('symbolic-ref refs/remotes/origin/HEAD', workDir, {
            error: 'Not a git repository'
        });
        manager.setMockResponse('rev-parse --verify main', workDir, {
            stdout: 'abc123',
            stderr: ''
        });
        manager.setMockResponse('rev-parse --verify master', workDir, {
            error: 'Not found'
        });
        
        const branch = await manager.getDefaultBranch(workDir);
        assert.equal(branch, 'main');
    });
    
    await t.test('falls back to master if main does not exist', async () => {
        manager.reset();
        manager.setMockResponse('symbolic-ref refs/remotes/origin/HEAD', workDir, {
            error: 'Not a git repository'
        });
        manager.setMockResponse('rev-parse --verify main', workDir, {
            error: 'Not found'
        });
        manager.setMockResponse('rev-parse --verify master', workDir, {
            stdout: 'def456',
            stderr: ''
        });
        
        const branch = await manager.getDefaultBranch(workDir);
        assert.equal(branch, 'master');
    });
});

test('Conflict Analysis', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    const workDir = '/test/workspace';
    
    await t.test('detects conflicts correctly', async () => {
        manager.reset();
        
        // Mock merge-base
        manager.setMockResponse('merge-base target source', workDir, {
            stdout: 'base123\n',
            stderr: ''
        });
        
        // Mock source branch changes
        manager.setMockResponse('diff --name-only base123...source', workDir, {
            stdout: 'file1.js\nfile2.js\nshared.js\n',
            stderr: ''
        });
        
        // Mock target branch changes
        manager.setMockResponse('diff --name-only base123...target', workDir, {
            stdout: 'file3.js\nshared.js\n',
            stderr: ''
        });
        
        const result = await manager.analyzeConflicts('source', 'target', workDir);
        
        assert.equal(result.hasConflicts, true);
        assert.deepEqual(result.conflicts, ['shared.js']);
        assert.equal(result.sourceChanges.length, 3);
        assert.equal(result.targetChanges.length, 2);
    });
    
    await t.test('handles no conflicts', async () => {
        manager.reset();
        
        manager.setMockResponse('merge-base target source', workDir, {
            stdout: 'base123\n',
            stderr: ''
        });
        
        manager.setMockResponse('diff --name-only base123...source', workDir, {
            stdout: 'file1.js\nfile2.js\n',
            stderr: ''
        });
        
        manager.setMockResponse('diff --name-only base123...target', workDir, {
            stdout: 'file3.js\nfile4.js\n',
            stderr: ''
        });
        
        const result = await manager.analyzeConflicts('source', 'target', workDir);
        
        assert.equal(result.hasConflicts, false);
        assert.deepEqual(result.conflicts, []);
    });
});

test('Auto-resolvable Files', async (t) => {
    const manager = new MockSharedWorkspaceGitManager();
    
    await t.test('identifies auto-resolvable extensions', () => {
        assert.equal(manager.isAutoResolvable('README.md'), true);
        assert.equal(manager.isAutoResolvable('data.json'), true);
        assert.equal(manager.isAutoResolvable('notes.txt'), true);
    });
    
    await t.test('excludes non-resolvable files', () => {
        assert.equal(manager.isAutoResolvable('package.json'), false);
        assert.equal(manager.isAutoResolvable('package-lock.json'), false);
        assert.equal(manager.isAutoResolvable('.gitignore'), false);
    });
    
    await t.test('handles different casings', () => {
        assert.equal(manager.isAutoResolvable('README.MD'), true);
        assert.equal(manager.isAutoResolvable('data.JSON'), true);
    });
});

// Run summary
test('Summary', () => {
    console.log('\n✨ Unit tests completed - using mocked git operations');
    console.log('   - No actual git commands executed');
    console.log('   - Fast and deterministic');
    console.log('   - Complete control over git responses');
});