import { InstanceManager } from '../src/instance_manager.js';
import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';

async function instructExecutive() {
    const manager = new InstanceManager('./state', { useRedis: true });
    const tools = new EnhancedMCPTools(manager);
    
    console.log('📤 Sending instructions to Executive...');
    
    await tools.send({
        instanceId: 'exec_757845',
        text: `Excellent plan! Please proceed as follows:

1. Start spawning managers according to your todo list, beginning with setup_manager
2. For EACH manager you spawn, give them these instructions:
   - "Work autonomously following your todo list"
   - "Complete all tasks without waiting for approval"
   - "Use todos to track your progress"
   - "Create any necessary files and implement features fully"

3. Monitor their progress and spawn the next manager when appropriate
4. Ensure managers work in parallel when possible (e.g., different feature managers can work simultaneously)

Important: Tell each manager to be fully autonomous and complete their entire scope of work. They should create, implement, and test their features completely.

Begin by spawning the setup_manager now.`
    });
    
    console.log('✅ Instructions sent!');
    
    // Monitor for new instances
    console.log('\n🔍 Monitoring for new manager instances...\n');
    
    let lastCount = 1;
    setInterval(async () => {
        const instances = await tools.list({});
        if (instances.length > lastCount) {
            console.log(`🆕 New instances detected! Total: ${instances.length}`);
            instances.forEach(inst => {
                console.log(`   ${inst.role === 'manager' ? '👔' : inst.role === 'specialist' ? '👷' : '👨‍💼'} ${inst.role}: ${inst.instanceId}`);
            });
            lastCount = instances.length;
        }
        
        // Check Executive's progress
        const progress = await tools.getProgress({ instanceId: 'exec_757845' });
        if (progress.progress.total > 0) {
            console.log(`\n📊 Executive Progress: ${progress.progress.completed}/${progress.progress.total} tasks (${progress.progress.completionRate}%)`);
        }
    }, 10000);
}

instructExecutive().catch(console.error);