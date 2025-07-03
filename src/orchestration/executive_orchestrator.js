/**
 * Executive Orchestrator Helper
 * Provides structured patterns for Executive instances to manage Managers
 */

import { spawnWithConfirmation } from './spawn_helpers.js';

class ExecutiveOrchestrator {
    constructor(tools, workDir) {
        this.tools = tools;
        this.workDir = workDir;
        this.managers = new Map();
        this.projectPlan = null;
    }

    /**
     * Create a project plan before spawning any managers
     */
    async createProjectPlan(projectRequirements) {
        this.projectPlan = {
            created: new Date().toISOString(),
            requirements: projectRequirements,
            managers: [],
            dependencies: {},
            milestones: []
        };
        
        return this.projectPlan;
    }

    /**
     * Spawn a Manager with verification and task assignment
     */
    async spawnManagerWithVerification(role, context, tasks) {
        if (!this.projectPlan) {
            throw new Error('Must create project plan before spawning managers');
        }
        
        // Enhanced context with clear task list
        const enhancedContext = `You are the ${role} for this project.

${context}

YOUR ASSIGNED TASKS:
${tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')}

IMPORTANT INSTRUCTIONS:
1. Create a todo item for each assigned task
2. Break down complex tasks into subtasks
3. Spawn Specialists for independent work units
4. Report progress regularly to the Executive
5. Ask for clarification if any task is unclear

When you receive this context, immediately reply with:
"READY: ${role} - understood ${tasks.length} tasks"`;

        // Spawn with confirmation
        const result = await spawnWithConfirmation(this.tools, {
            role: 'manager',
            workDir: this.workDir,
            context: enhancedContext
        });
        
        if (result.status !== 'ready') {
            throw new Error(`Manager ${role} failed to initialize: ${result.message}`);
        }
        
        // Track the manager
        this.managers.set(role, {
            instanceId: result.instanceId,
            tasks,
            status: 'active',
            spawnedAt: new Date().toISOString(),
            lastProgress: null
        });
        
        // Update project plan
        this.projectPlan.managers.push({
            role,
            instanceId: result.instanceId,
            tasks
        });
        
        console.log(`✓ Manager spawned: ${role} (${result.instanceId})`);
        return result.instanceId;
    }

    /**
     * Check progress of all managers
     */
    async checkAllManagerProgress() {
        const progressReport = {
            timestamp: new Date().toISOString(),
            managers: {},
            summary: {
                total: 0,
                completed: 0,
                inProgress: 0,
                blocked: 0
            }
        };
        
        for (const [role, manager] of this.managers) {
            try {
                // Get progress from todos
                const progress = await this.tools.getProgress({ 
                    instanceId: manager.instanceId 
                });
                
                const managerProgress = {
                    instanceId: manager.instanceId,
                    status: manager.status,
                    totalTasks: progress.todos.length,
                    completed: progress.todos.filter(t => t.status === 'completed').length,
                    inProgress: progress.todos.filter(t => t.status === 'in_progress').length,
                    blocked: progress.todos.filter(t => 
                        t.content.toLowerCase().includes('blocked') ||
                        t.content.toLowerCase().includes('error')
                    ).length,
                    todos: progress.todos
                };
                
                progressReport.managers[role] = managerProgress;
                
                // Update summary
                progressReport.summary.total += managerProgress.totalTasks;
                progressReport.summary.completed += managerProgress.completed;
                progressReport.summary.inProgress += managerProgress.inProgress;
                progressReport.summary.blocked += managerProgress.blocked;
                
                // Update manager's last progress
                manager.lastProgress = managerProgress;
                
            } catch (error) {
                progressReport.managers[role] = {
                    error: error.message,
                    status: 'error'
                };
            }
        }
        
        return progressReport;
    }

    /**
     * Send a message to all managers
     */
    async broadcastToManagers(message) {
        const results = [];
        
        for (const [role, manager] of this.managers) {
            try {
                // Use enhanced send if available
                if (this.tools.enhancedSend) {
                    await this.tools.enhancedSend({
                        targetInstanceId: manager.instanceId,
                        message,
                        priority: 'high'
                    });
                } else {
                    await this.tools.send({
                        instanceId: manager.instanceId,
                        text: message
                    });
                }
                
                results.push({ role, success: true });
            } catch (error) {
                results.push({ role, success: false, error: error.message });
            }
        }
        
        return results;
    }

    /**
     * Check for blocked managers and help resolve issues
     */
    async checkForBlockers() {
        const blockers = [];
        const progress = await this.checkAllManagerProgress();
        
        for (const [role, managerProgress] of Object.entries(progress.managers)) {
            if (managerProgress.blocked > 0) {
                const blockedTodos = managerProgress.todos.filter(t => 
                    t.content.toLowerCase().includes('blocked') ||
                    t.content.toLowerCase().includes('error')
                );
                
                blockers.push({
                    role,
                    instanceId: this.managers.get(role).instanceId,
                    blockedTasks: blockedTodos
                });
            }
        }
        
        return blockers;
    }

    /**
     * Coordinate manager dependencies
     */
    async coordinateDependency(dependentRole, dependsOnRole, message) {
        const dependent = this.managers.get(dependentRole);
        const dependsOn = this.managers.get(dependsOnRole);
        
        if (!dependent || !dependsOn) {
            throw new Error('Both managers must exist to coordinate dependency');
        }
        
        // Send coordination message
        await this.tools.send({
            instanceId: dependent.instanceId,
            text: `DEPENDENCY: Wait for ${dependsOnRole} to complete: ${message}`
        });
        
        await this.tools.send({
            instanceId: dependsOn.instanceId,
            text: `DEPENDENCY: ${dependentRole} is waiting for you to: ${message}`
        });
        
        // Track dependency
        if (!this.projectPlan.dependencies[dependentRole]) {
            this.projectPlan.dependencies[dependentRole] = [];
        }
        this.projectPlan.dependencies[dependentRole].push({
            dependsOn: dependsOnRole,
            reason: message,
            created: new Date().toISOString()
        });
    }

    /**
     * Generate a progress summary for display
     */
    async generateProgressSummary() {
        const progress = await this.checkAllManagerProgress();
        
        let summary = `# Project Progress Report\n\n`;
        summary += `Generated: ${progress.timestamp}\n\n`;
        summary += `## Overall Progress\n`;
        summary += `- Total Tasks: ${progress.summary.total}\n`;
        summary += `- Completed: ${progress.summary.completed} (${Math.round(progress.summary.completed / progress.summary.total * 100)}%)\n`;
        summary += `- In Progress: ${progress.summary.inProgress}\n`;
        summary += `- Blocked: ${progress.summary.blocked}\n\n`;
        
        summary += `## Manager Status\n\n`;
        
        for (const [role, managerProgress] of Object.entries(progress.managers)) {
            if (managerProgress.error) {
                summary += `### ${role} ❌\n`;
                summary += `Error: ${managerProgress.error}\n\n`;
            } else {
                const completion = Math.round(managerProgress.completed / managerProgress.totalTasks * 100) || 0;
                const statusEmoji = completion === 100 ? '✅' : managerProgress.blocked > 0 ? '⚠️' : '🔄';
                
                summary += `### ${role} ${statusEmoji}\n`;
                summary += `- Progress: ${managerProgress.completed}/${managerProgress.totalTasks} (${completion}%)\n`;
                summary += `- In Progress: ${managerProgress.inProgress}\n`;
                if (managerProgress.blocked > 0) {
                    summary += `- **Blocked: ${managerProgress.blocked}**\n`;
                }
                summary += '\n';
            }
        }
        
        return summary;
    }

    /**
     * Gracefully terminate a manager
     */
    async terminateManager(role, reason) {
        const manager = this.managers.get(role);
        if (!manager) {
            throw new Error(`Manager ${role} not found`);
        }
        
        // Notify the manager
        await this.tools.send({
            instanceId: manager.instanceId,
            text: `TERMINATION: You are being terminated. Reason: ${reason}`
        });
        
        // Give time for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Terminate
        await this.tools.terminate({
            instanceId: manager.instanceId,
            cascade: true
        });
        
        // Update tracking
        manager.status = 'terminated';
        manager.terminatedAt = new Date().toISOString();
        manager.terminationReason = reason;
        
        console.log(`Manager ${role} terminated: ${reason}`);
    }
}

export { ExecutiveOrchestrator };