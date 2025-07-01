#!/usr/bin/env node
/**
 * Automated Import Fixer for MCP Tools Consolidation
 * 
 * This script fixes all broken imports after consolidating mcp_tools.js 
 * and shared_workspace_mcp_tools.js into enhanced_mcp_tools.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = __dirname;

// Files that need fixing (excluding worktrees)
const FILES_TO_FIX = [
    // Tests
    'tests/integration/test_shared_workspace_quick.js',
    'tests/integration/test_workspace_modes.js',
    'tests/integration/test_shared_workspace_git_integration.js',
    'tests/integration/test_git_integration_isolated.js',
    'tests/integration/test_git_integration_improved.js',
    'tests/integration/phase3_integration_test.js',
    'tests/performance/performance_benchmark.js',
    'tests/performance/phase3_load_test.js',
    'tests/e2e/test_real_spawn.js',
    'tests/e2e/test_read_executive.js',
    'tests/e2e/test_monitor_executive.js',
    'tests/e2e/test_help_executive.js',
    'tests/e2e/test_error_scenarios.js',
    'tests/e2e/test_delegation_clean.js',
    'tests/e2e/test_architectural_alignment.js',
    'tests/e2e/phase3_parallel_demo.js',
    
    // VM Integration
    'vm-integration/demo_vm_integration.js',
    'vm-integration/integrate_vm_mcp.js',
    'vm-integration/tests/test_vm_integration.js',
    
    // Workflows
    'workflows/test_enhanced_tools_execution.js',
    'workflows/validate_server_setup.js',
    'workflows/server_readiness_report.js',
    'workflows/test_server_startup.js',
    'workflows/test_simple_mcp_server.js',
    
    // Scripts
    'scripts/spawn_desktop_ui_v2.js',
    'scripts/instruct_executive.js',
    'scripts/monitor_executive.js'
];

async function fixFile(filePath) {
    try {
        const fullPath = path.join(PROJECT_ROOT, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        let modified = false;
        let newContent = content;
        
        // Fix imports
        if (content.includes("from '../../src/mcp_tools.js'") || 
            content.includes('from "../../src/mcp_tools.js"')) {
            newContent = newContent.replace(
                /from ['"]\.\.\/\.\.\/src\/mcp_tools\.js['"]/g,
                "from '../../src/enhanced_mcp_tools.js'"
            );
            modified = true;
        }
        
        if (content.includes("from '../src/mcp_tools.js'") || 
            content.includes('from "../src/mcp_tools.js"')) {
            newContent = newContent.replace(
                /from ['"]\.\.\/src\/mcp_tools\.js['"]/g,
                "from '../src/enhanced_mcp_tools.js'"
            );
            modified = true;
        }
        
        if (content.includes("from './src/mcp_tools.js'") || 
            content.includes('from "./src/mcp_tools.js"')) {
            newContent = newContent.replace(
                /from ['"]\.\/src\/mcp_tools\.js['"]/g,
                "from './src/enhanced_mcp_tools.js'"
            );
            modified = true;
        }
        
        // Fix shared workspace imports
        if (content.includes("shared_workspace_mcp_tools.js")) {
            newContent = newContent.replace(
                /from ['"][^'"]*shared_workspace_mcp_tools\.js['"]/g,
                (match) => {
                    if (match.includes("'../../src/")) return "from '../../src/enhanced_mcp_tools.js'";
                    if (match.includes("'../src/")) return "from '../src/enhanced_mcp_tools.js'";
                    if (match.includes("'./src/")) return "from './src/enhanced_mcp_tools.js'";
                    return match.replace('shared_workspace_mcp_tools.js', 'enhanced_mcp_tools.js');
                }
            );
            modified = true;
        }
        
        // Fix class names in imports
        if (content.includes('{ MCPTools }')) {
            newContent = newContent.replace(/\{ MCPTools \}/g, '{ EnhancedMCPTools }');
            modified = true;
        }
        
        if (content.includes('{ SharedWorkspaceMCPTools }')) {
            newContent = newContent.replace(/\{ SharedWorkspaceMCPTools \}/g, '{ EnhancedMCPTools }');
            modified = true;
        }
        
        // Fix class instantiations
        if (content.includes('new MCPTools(')) {
            newContent = newContent.replace(/new MCPTools\(/g, 'new EnhancedMCPTools(');
            modified = true;
        }
        
        if (content.includes('new SharedWorkspaceMCPTools(')) {
            newContent = newContent.replace(/new SharedWorkspaceMCPTools\(/g, 'new EnhancedMCPTools(');
            modified = true;
        }
        
        if (modified) {
            await fs.writeFile(fullPath, newContent, 'utf8');
            console.log(`✅ Fixed: ${filePath}`);
            return true;
        } else {
            console.log(`⏭️  Skipped: ${filePath} (no changes needed)`);
            return false;
        }
        
    } catch (error) {
        console.error(`❌ Error fixing ${filePath}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔧 Fixing imports after MCP tools consolidation...\n');
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const filePath of FILES_TO_FIX) {
        const fullPath = path.join(PROJECT_ROOT, filePath);
        
        try {
            await fs.access(fullPath);
            const wasFixed = await fixFile(filePath);
            if (wasFixed) fixedCount++;
        } catch (error) {
            console.log(`⚠️  File not found: ${filePath}`);
        }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Fixed: ${fixedCount} files`);
    console.log(`   Errors: ${errorCount} files`);
    console.log(`\n✅ Import fixing complete!`);
}

main().catch(console.error);