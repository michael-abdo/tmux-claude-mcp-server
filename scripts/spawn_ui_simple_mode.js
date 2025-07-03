import fs from 'fs/promises';
import { phase1Mode } from '../src/phase1_simple_mode.js';

async function runUIProjectSimple() {
    console.log('🚀 Starting WealthVista Project in Simple Mode (Phase 1)');
    
    // Clean up any existing instances
    for (const instance of phase1Mode.listInstances()) {
        await phase1Mode.terminateInstance(instance.instanceId);
    }
    
    // Read project description
    const projectDesc = await fs.readFile('/Users/Mike/Desktop/upwork/test/DesktopUI.md', 'utf-8');
    
    // Spawn setup Manager directly
    console.log('\n👔 Creating Setup Manager...');
    const setupMgr = await phase1Mode.spawnSimple({
        role: 'manager',
        workDir: '/Users/Mike/Desktop/upwork/test/desktop-ui-implementation',
        context: `You are the Setup Manager for WealthVista Portfolio Manager.

PROJECT OVERVIEW:
${projectDesc}

YOUR SPECIFIC RESPONSIBILITIES:
1. Initialize the project repository
2. Create the project structure (folders for js/, css/, images/, etc.)
3. Set up index.html with basic structure
4. Create initial CSS files with the color scheme
5. Set up basic JavaScript architecture
6. Commit everything to git

Work autonomously and complete all tasks. Create all necessary files.`,
        parentId: 'exec_757845'
    });
    
    console.log('✅ Setup Manager created:', setupMgr.instanceId);
    console.log('📁 Working directory:', setupMgr.projectDir);
    console.log('🌿 Git branch:', setupMgr.branchName);
    console.log('🖥️  View in tmux: tmux attach -t', setupMgr.sessionName);
    
    // Give initial instructions
    await phase1Mode.sendToInstance(
        setupMgr.instanceId,
        'Please begin implementing the project setup. Create all necessary files and folder structure for WealthVista Portfolio Manager. Work autonomously and complete all tasks.'
    );
    
    // Monitor progress
    console.log('\n📊 Monitoring progress...');
    setInterval(async () => {
        const progress = phase1Mode.getProgress(setupMgr.instanceId);
        console.log(`Progress: ${progress.completed}/${progress.total} tasks (${progress.completionRate}%)`);
        
        // List all instances
        const instances = phase1Mode.listInstances();
        if (instances.length > 0) {
            console.log('Active instances:', instances.map(i => `${i.role}:${i.instanceId}`).join(', '));
        }
    }, 15000);
}

runUIProjectSimple().catch(console.error);