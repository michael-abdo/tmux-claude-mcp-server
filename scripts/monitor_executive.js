import { InstanceManager } from '../src/instance_manager.js';
import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';

async function monitorExecutive() {
    const manager = new InstanceManager('./state', { useRedis: true });
    const tools = new EnhancedMCPTools(manager);
    
    const execId = 'exec_757845';
    
    // Get progress
    const progress = await tools.getProgress({ instanceId: execId });
    console.log('📊 Executive Progress:');
    console.log(`   Total tasks: ${progress.progress.total}`);
    console.log(`   Completed: ${progress.progress.completed}`);
    console.log(`   In Progress: ${progress.progress.inProgress}`);
    console.log(`   Pending: ${progress.progress.pending}`);
    console.log(`   Completion: ${progress.progress.completionRate}%`);
    
    // Get todos
    const todos = await manager.todoMonitor?.getTodos(execId) || [];
    if (todos.length > 0) {
        console.log('\n📝 Todo List:');
        todos.forEach(todo => {
            const icon = todo.status === 'completed' ? '✅' : 
                         todo.status === 'in_progress' ? '🔄' : '⏳';
            console.log(`   ${icon} ${todo.content}`);
        });
    }
    
    // List all instances
    const instances = await tools.list({});
    console.log('\n👥 Active Instances:');
    instances.forEach(inst => {
        console.log(`   - ${inst.role}: ${inst.instanceId} (parent: ${inst.parentId || 'none'})`);
    });
    
    // Read recent output
    const output = await tools.read({ instanceId: execId, lines: 20 });
    console.log('\n📜 Recent Output:');
    console.log(output.output);
}

monitorExecutive().catch(console.error);