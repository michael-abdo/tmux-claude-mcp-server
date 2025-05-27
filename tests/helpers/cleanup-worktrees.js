#!/usr/bin/env node

/**
 * Cleanup script for test worktrees
 * Removes all test-related worktree directories
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanupWorktrees() {
    console.log('🧹 Cleaning up test worktrees...\n');
    
    const projectRoot = path.join(__dirname, '..');
    
    // Find all worktree directories
    const entries = await fs.readdir(projectRoot);
    const worktreeDirs = entries.filter(entry => entry.endsWith('-worktrees'));
    
    for (const dir of worktreeDirs) {
        const fullPath = path.join(projectRoot, dir);
        console.log(`  Removing: ${dir}`);
        await fs.rm(fullPath, { recursive: true, force: true });
    }
    
    // Also check git worktrees
    try {
        const worktreeList = execSync('git worktree list', { cwd: projectRoot }).toString();
        const lines = worktreeList.split('\n').filter(line => line.includes('test-'));
        
        if (lines.length > 0) {
            console.log('\n  Found git worktrees to prune:');
            for (const line of lines) {
                console.log(`    ${line}`);
            }
            
            execSync('git worktree prune', { cwd: projectRoot });
            console.log('  ✓ Pruned stale worktrees');
        }
    } catch (error) {
        // Ignore git errors
    }
    
    console.log('\n✅ Cleanup complete!');
}

cleanupWorktrees().catch(console.error);