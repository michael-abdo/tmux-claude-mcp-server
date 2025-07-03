import fs from 'fs/promises';
import path from 'path';

// Import from the tmux-claude directory
const tmuxClaudeDir = '/Users/Mike/.claude/user/tmux-claude-mcp-server';
process.chdir(tmuxClaudeDir); // Change to the correct directory

const { InstanceManager } = await import('./src/instance_manager.js');
const { EnhancedMCPTools } = await import('./src/enhanced_mcp_tools.js');

async function cleanupAndSpawn() {
    try {
        const manager = new InstanceManager('./state', { useRedis: true });
        const tools = new EnhancedMCPTools(manager);
        
        // First, clean up the old instance
        console.log('Cleaning up old instance...');
        try {
            await tools.terminate({ instanceId: 'exec_265321' });
        } catch (e) {
            console.log('No old instance to clean up');
        }
        
        // Read the DesktopUI.md file
        const projectContent = await fs.readFile('/Users/Mike/Desktop/upwork/test/DesktopUI.md', 'utf-8');
        
        console.log('Creating new Executive with corrected Claude launch...');
        
        // Create new Executive
        const result = await tools.spawn({
            role: 'executive',
            workDir: '/Users/Mike/Desktop/upwork/test/desktop-ui-implementation',
            context: `You are the Executive for a Desktop UI Project.

⚠️ CRITICAL: YOU MUST DELEGATE ALL IMPLEMENTATION ⚠️
- DO NOT write any code yourself
- DO NOT create UI components  
- DO NOT implement features
- ONLY plan and spawn Managers who will spawn Specialists

PROJECT REQUIREMENTS:
${projectContent}

YOUR RESPONSIBILITIES:
1. Analyze all requirements and create a comprehensive implementation plan
2. Break down the work into phases as specified in the requirements
3. Create detailed task lists using todo items
4. Spawn Manager instances for different aspects (UI, Features, Testing)
5. Monitor progress and ensure all requirements are met

MANDATORY WORKFLOW:
1. Create PROJECT_PLAN.md with detailed breakdown
2. Spawn Managers (NOT implement yourself)
3. Verify Managers understand their tasks
4. Monitor progress regularly

Remember: If you find yourself writing code, STOP and spawn a Manager instead!

Start by creating a detailed project plan and task breakdown.`
        });
        
        console.log('✅ Executive spawned:', result);
        console.log('📁 Project directory:', result.projectPath);
        console.log('\n🖥️  View in tmux: tmux attach -t claude_' + result.instanceId);
        
        // Wait a bit for Claude to initialize
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Send initial command
        await tools.send({
            instanceId: result.instanceId,
            text: 'Please analyze the Desktop UI project requirements and create a comprehensive implementation plan with phases, managers, and task breakdown.'
        });
        
        console.log('\n✅ Initial command sent!');
        console.log('\nMonitoring progress...');
        
        // Monitor progress
        setInterval(async () => {
            try {
                const progress = await tools.getProgress({
                    instanceId: result.instanceId
                });
                
                if (progress.progress.total > 0) {
                    console.log(`📊 Progress: ${progress.progress.completed}/${progress.progress.total} tasks (${progress.progress.completionRate}%)`);
                }
                
                // Also check for any spawned managers
                const instances = await tools.list({});
                if (instances.length > 1) {
                    console.log(`👥 Active instances: ${instances.length}`);
                    instances.forEach(inst => {
                        console.log(`  - ${inst.role}: ${inst.instanceId}`);
                    });
                }
            } catch (e) {
                // Ignore errors
            }
        }, 15000); // Check every 15 seconds
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

cleanupAndSpawn();