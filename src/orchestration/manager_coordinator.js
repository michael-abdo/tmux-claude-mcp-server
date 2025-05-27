/**
 * Manager Coordinator Helper
 * Provides structured patterns for Manager instances to coordinate Specialists
 */

import { spawnWithConfirmation, spawnMultipleWithConfirmation } from './spawn_helpers.js';
import { ProjectState } from '../project/project_state.js';

class ManagerCoordinator {
    constructor(tools, workDir) {
        this.tools = tools;
        this.workDir = workDir;
        this.projectState = new ProjectState(workDir);
        this.specialists = new Map();
        this.taskQueue = [];
        this.maxConcurrentSpecialists = 5;
    }

    /**
     * Analyze task dependencies and create execution plan
     */
    async planParallelWork(tasks) {
        const taskGraph = [];
        
        for (const task of tasks) {
            const taskInfo = {
                id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: task.name || task,
                files: await this.predictFileModifications(task),
                dependencies: await this.analyzeDependencies(task),
                estimatedTime: await this.estimateTime(task),
                priority: task.priority || 'normal'
            };
            
            taskGraph.push(taskInfo);
        }
        
        // Group independent tasks for parallel execution
        const parallelGroups = this.groupIndependentTasks(taskGraph);
        
        return {
            taskGraph,
            parallelGroups,
            totalTasks: taskGraph.length,
            estimatedTotalTime: taskGraph.reduce((sum, t) => sum + t.estimatedTime, 0)
        };
    }

    /**
     * Predict which files a task will modify
     */
    async predictFileModifications(task) {
        const taskStr = typeof task === 'string' ? task : task.name;
        const files = [];
        
        // Simple heuristic - in real implementation, this would be more sophisticated
        if (taskStr.toLowerCase().includes('navigation')) {
            files.push('src/components/navigation.js', 'src/styles/navigation.css');
        }
        if (taskStr.toLowerCase().includes('footer')) {
            files.push('src/components/footer.js', 'src/styles/footer.css');
        }
        if (taskStr.toLowerCase().includes('header')) {
            files.push('src/components/header.js', 'src/styles/header.css');
        }
        if (taskStr.toLowerCase().includes('api')) {
            files.push('src/api/', 'src/services/');
        }
        if (taskStr.toLowerCase().includes('test')) {
            files.push('tests/', 'src/**/*.test.js');
        }
        
        // If no specific files predicted, assume general work
        if (files.length === 0) {
            files.push('src/');
        }
        
        return files;
    }

    /**
     * Analyze task dependencies
     */
    async analyzeDependencies(task) {
        const taskStr = typeof task === 'string' ? task : task.name;
        const dependencies = [];
        
        // Check if task mentions other components
        if (taskStr.includes('integrate') || taskStr.includes('connect')) {
            // Integration tasks usually depend on component completion
            dependencies.push('component-implementation');
        }
        
        if (taskStr.includes('test') && !taskStr.includes('unit')) {
            // Integration tests depend on feature implementation
            dependencies.push('feature-implementation');
        }
        
        if (taskStr.includes('style') || taskStr.includes('theme')) {
            // Styling often depends on structure
            dependencies.push('structure-implementation');
        }
        
        return dependencies;
    }

    /**
     * Estimate task completion time (in minutes)
     */
    async estimateTime(task) {
        const taskStr = typeof task === 'string' ? task : task.name;
        
        // Simple estimation based on task complexity
        if (taskStr.includes('simple') || taskStr.includes('basic')) return 10;
        if (taskStr.includes('complex') || taskStr.includes('advanced')) return 30;
        if (taskStr.includes('test')) return 15;
        if (taskStr.includes('refactor')) return 20;
        
        return 15; // Default estimate
    }

    /**
     * Group tasks that can be executed in parallel
     */
    groupIndependentTasks(taskGraph) {
        const groups = [];
        const assigned = new Set();
        
        while (assigned.size < taskGraph.length) {
            const group = [];
            const groupFiles = new Set();
            
            for (const task of taskGraph) {
                if (assigned.has(task.id)) continue;
                
                // Check dependencies
                const depsmet = task.dependencies.every(dep => 
                    Array.from(assigned).some(id => 
                        taskGraph.find(t => t.id === id)?.name.includes(dep)
                    )
                );
                
                if (!depsmet) continue;
                
                // Check file conflicts
                const hasConflict = task.files.some(f => groupFiles.has(f));
                if (hasConflict) continue;
                
                // Add to group
                group.push(task);
                task.files.forEach(f => groupFiles.add(f));
                assigned.add(task.id);
                
                // Limit group size
                if (group.length >= this.maxConcurrentSpecialists) break;
            }
            
            if (group.length > 0) {
                groups.push(group);
            } else {
                // Handle circular dependencies or conflicts
                const remaining = taskGraph.filter(t => !assigned.has(t.id));
                if (remaining.length > 0) {
                    groups.push([remaining[0]]);
                    assigned.add(remaining[0].id);
                }
            }
        }
        
        return groups;
    }

    /**
     * Spawn a specialist with file coordination
     */
    async spawnSpecialistSafely(task, taskId) {
        // Check file availability
        for (const file of task.files) {
            const available = await this.projectState.checkFileAvailability(file);
            if (!available) {
                throw new Error(`File ${file} is being modified by another specialist`);
            }
        }
        
        // Record intent to modify files
        for (const file of task.files) {
            await this.projectState.recordFileModification(file, 'claimed');
        }
        
        // Create specialist context
        const context = `You are a Specialist implementing: ${task.name}

TASK DETAILS:
${JSON.stringify(task, null, 2)}

FILES YOU WILL MODIFY:
${task.files.map(f => `- ${f}`).join('\n')}

IMPORTANT CONSTRAINTS:
1. Create your feature branch: specialist-{instanceId}-${taskId}-${task.name.replace(/\s+/g, '-')}
2. ONLY modify the files listed above
3. Make atomic, focused commits
4. Test your changes before marking complete
5. If you need to modify other files, STOP and report back

WORKFLOW:
1. git checkout -b your-feature-branch
2. Implement the task
3. Test thoroughly
4. Commit with clear messages
5. Update todos when complete

When ready, reply: "READY: Specialist - implementing ${task.name}"`;

        // Spawn with confirmation
        const result = await spawnWithConfirmation(this.tools, {
            role: 'specialist',
            workDir: this.workDir,
            context
        });
        
        if (result.status !== 'ready') {
            // Release file locks on failure
            for (const file of task.files) {
                await this.projectState.recordFileModification(file, 'released');
            }
            throw new Error(`Specialist failed to initialize: ${result.message}`);
        }
        
        // Track the specialist
        this.specialists.set(result.instanceId, {
            task,
            taskId,
            status: 'active',
            spawnedAt: new Date().toISOString(),
            files: task.files
        });
        
        console.log(`✓ Specialist spawned for: ${task.name} (${result.instanceId})`);
        return result.instanceId;
    }

    /**
     * Execute a group of tasks in parallel
     */
    async executeParallelTasks(taskGroup) {
        console.log(`Executing ${taskGroup.length} tasks in parallel...`);
        
        const spawnPromises = taskGroup.map(task => 
            this.spawnSpecialistSafely(task, task.id)
                .catch(error => ({
                    error: error.message,
                    task: task.name
                }))
        );
        
        const results = await Promise.all(spawnPromises);
        
        // Check for failures
        const failures = results.filter(r => r.error);
        if (failures.length > 0) {
            console.error('Failed to spawn specialists:', failures);
        }
        
        const successfulSpawns = results.filter(r => !r.error);
        console.log(`Successfully spawned ${successfulSpawns.length} specialists`);
        
        return {
            successful: successfulSpawns,
            failed: failures
        };
    }

    /**
     * Monitor all active specialists
     */
    async monitorSpecialists() {
        const report = {
            timestamp: new Date().toISOString(),
            specialists: {},
            summary: {
                total: this.specialists.size,
                active: 0,
                completed: 0,
                blocked: 0
            }
        };
        
        for (const [instanceId, specialist] of this.specialists) {
            try {
                // Get progress
                const progress = await this.tools.getProgress({ instanceId });
                
                // Get git branch
                const branch = await this.tools.getGitBranch({ instanceId }).catch(() => null);
                
                const specialistReport = {
                    task: specialist.task.name,
                    files: specialist.files,
                    branch: branch?.currentBranch || 'unknown',
                    status: specialist.status,
                    progress: {
                        total: progress.todos.length,
                        completed: progress.todos.filter(t => t.status === 'completed').length,
                        inProgress: progress.todos.filter(t => t.status === 'in_progress').length
                    }
                };
                
                // Check if completed
                if (progress.todos.length > 0 && 
                    progress.todos.every(t => t.status === 'completed')) {
                    specialist.status = 'completed';
                    specialistReport.status = 'completed';
                    
                    // Release file locks
                    for (const file of specialist.files) {
                        await this.projectState.recordFileModification(file, 'released');
                    }
                    
                    // Record completion
                    await this.projectState.recordCompletion(
                        specialist.task.name,
                        { instanceId, branch: branch?.currentBranch }
                    );
                }
                
                // Update summary
                if (specialist.status === 'active') report.summary.active++;
                if (specialist.status === 'completed') report.summary.completed++;
                
                // Check for blockers
                const blocked = progress.todos.some(t => 
                    t.content.toLowerCase().includes('blocked') ||
                    t.content.toLowerCase().includes('error')
                );
                if (blocked) {
                    report.summary.blocked++;
                    specialistReport.blocked = true;
                }
                
                report.specialists[instanceId] = specialistReport;
                
            } catch (error) {
                report.specialists[instanceId] = {
                    error: error.message,
                    task: specialist.task.name
                };
            }
        }
        
        return report;
    }

    /**
     * Merge completed specialist work
     */
    async mergeSpecialistWork(instanceId) {
        const specialist = this.specialists.get(instanceId);
        if (!specialist) {
            throw new Error('Specialist not found');
        }
        
        if (specialist.status !== 'completed') {
            throw new Error('Specialist work not completed');
        }
        
        try {
            // Get branch info
            const branch = await this.tools.getGitBranch({ instanceId });
            
            // Merge the branch
            const mergeResult = await this.tools.mergeBranch({
                instanceId,
                message: `Merge: ${specialist.task.name}`
            });
            
            // Update status
            specialist.status = 'merged';
            specialist.mergedAt = new Date().toISOString();
            
            console.log(`✓ Merged specialist work: ${specialist.task.name}`);
            return mergeResult;
            
        } catch (error) {
            throw new Error(`Failed to merge specialist work: ${error.message}`);
        }
    }

    /**
     * Handle blocked specialists
     */
    async resolveBlockedSpecialist(instanceId, resolution) {
        const specialist = this.specialists.get(instanceId);
        if (!specialist) {
            throw new Error('Specialist not found');
        }
        
        // Send resolution message
        await this.tools.send({
            instanceId: instanceId,
            text: `RESOLUTION: ${resolution}`
        });
        
        // Release file locks if terminating
        if (resolution.includes('terminate') || resolution.includes('cancel')) {
            for (const file of specialist.files) {
                await this.projectState.recordFileModification(file, 'released');
            }
            specialist.status = 'cancelled';
        }
    }

    /**
     * Generate specialist coordination report
     */
    async generateCoordinationReport() {
        const monitor = await this.monitorSpecialists();
        const projectSummary = await this.projectState.getSummary();
        
        let report = `# Specialist Coordination Report\n\n`;
        report += `Generated: ${monitor.timestamp}\n\n`;
        
        report += `## Summary\n`;
        report += `- Total Specialists: ${monitor.summary.total}\n`;
        report += `- Active: ${monitor.summary.active}\n`;
        report += `- Completed: ${monitor.summary.completed}\n`;
        report += `- Blocked: ${monitor.summary.blocked}\n\n`;
        
        report += `## Project State\n`;
        report += `- Completed Tasks: ${projectSummary.completedTasks}\n`;
        report += `- Active Files: ${projectSummary.activeFiles}\n`;
        report += `- Knowledge Items: ${projectSummary.knowledgeItems}\n`;
        report += `- Unresolved Conflicts: ${projectSummary.unresolvedConflicts}\n\n`;
        
        report += `## Active Specialists\n\n`;
        
        for (const [id, spec] of Object.entries(monitor.specialists)) {
            if (spec.error) {
                report += `### ${id} ❌\n`;
                report += `- Task: ${spec.task}\n`;
                report += `- Error: ${spec.error}\n\n`;
            } else {
                const emoji = spec.status === 'completed' ? '✅' : 
                             spec.blocked ? '⚠️' : '🔄';
                report += `### ${spec.task} ${emoji}\n`;
                report += `- Instance: ${id}\n`;
                report += `- Branch: ${spec.branch}\n`;
                report += `- Progress: ${spec.progress.completed}/${spec.progress.total}\n`;
                report += `- Files: ${spec.files.join(', ')}\n`;
                if (spec.blocked) {
                    report += `- **STATUS: BLOCKED**\n`;
                }
                report += '\n';
            }
        }
        
        return report;
    }
}

export { ManagerCoordinator };