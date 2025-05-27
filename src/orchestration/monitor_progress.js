/**
 * Progress monitoring helpers for orchestration
 * Provides comprehensive monitoring of all instances and their progress
 */

/**
 * Monitor progress of all instances
 * @param {Object} tools - MCP tools object
 * @returns {Object} - Comprehensive progress report
 */
async function monitorAllProgress(tools) {
    const instances = await tools.list();
    const report = {
        timestamp: new Date().toISOString(),
        executives: [],
        managers: [],
        specialists: [],
        summary: {
            total: 0,
            active: 0,
            completed: 0,
            blocked: 0,
            withErrors: 0
        },
        hierarchy: {}
    };
    
    // Handle both array and object format
    const instanceList = Array.isArray(instances) ? instances : instances.instances || [];
    
    // Process each instance
    for (const instance of instanceList) {
        try {
            // Get progress (handle both id and instanceId)
            const instanceId = instance.instanceId || instance.id;
            const progress = await tools.getProgress({ instanceId });
            
            // Get branch for specialists
            let branch = null;
            if (instance.role === 'specialist') {
                try {
                    const branchInfo = await tools.getGitBranch({ instanceId });
                    branch = branchInfo.currentBranch;
                } catch (e) {
                    branch = 'unknown';
                }
            }
            
            // Build instance report
            const instanceReport = {
                id: instanceId,
                role: instance.role,
                status: instance.status,
                parentId: instance.parentId,
                workDir: instance.workDir,
                branch,
                progress: {
                    total: progress.todos.length,
                    completed: progress.todos.filter(t => t.status === 'completed').length,
                    inProgress: progress.todos.filter(t => t.status === 'in_progress').length,
                    pending: progress.todos.filter(t => t.status === 'pending').length,
                    blocked: progress.todos.filter(t => 
                        t.content.toLowerCase().includes('blocked') ||
                        t.content.toLowerCase().includes('error') ||
                        t.content.toLowerCase().includes('failed')
                    ).length
                },
                todos: progress.todos,
                completionRate: progress.todos.length > 0 
                    ? Math.round(progress.todos.filter(t => t.status === 'completed').length / progress.todos.length * 100)
                    : 0
            };
            
            // Categorize by role
            if (instance.role === 'executive') {
                report.executives.push(instanceReport);
            } else if (instance.role === 'manager') {
                report.managers.push(instanceReport);
            } else {
                report.specialists.push(instanceReport);
            }
            
            // Build hierarchy
            if (instance.parentId) {
                if (!report.hierarchy[instance.parentId]) {
                    report.hierarchy[instance.parentId] = [];
                }
                report.hierarchy[instance.parentId].push(instanceId);
            }
            
            // Update summary
            report.summary.total++;
            if (instance.status === 'active') report.summary.active++;
            if (instanceReport.completionRate === 100 && instanceReport.progress.total > 0) {
                report.summary.completed++;
            }
            if (instanceReport.progress.blocked > 0) report.summary.blocked++;
            
        } catch (error) {
            // Instance with error
            report.summary.withErrors++;
            const errorReport = {
                id: instance.instanceId || instance.id,
                role: instance.role,
                status: 'error',
                error: error.message
            };
            
            if (instance.role === 'executive') {
                report.executives.push(errorReport);
            } else if (instance.role === 'manager') {
                report.managers.push(errorReport);
            } else {
                report.specialists.push(errorReport);
            }
        }
    }
    
    return report;
}

/**
 * Generate a visual progress report
 * @param {Object} progressData - Data from monitorAllProgress
 * @returns {string} - Formatted report
 */
function generateProgressReport(progressData) {
    let report = `# Orchestration Progress Report\n\n`;
    report += `Generated: ${progressData.timestamp}\n\n`;
    
    // Summary
    report += `## Summary\n`;
    report += `- Total Instances: ${progressData.summary.total}\n`;
    report += `- Active: ${progressData.summary.active}\n`;
    report += `- Completed: ${progressData.summary.completed}\n`;
    report += `- Blocked: ${progressData.summary.blocked}\n`;
    report += `- With Errors: ${progressData.summary.withErrors}\n\n`;
    
    // Executives
    if (progressData.executives.length > 0) {
        report += `## Executives (${progressData.executives.length})\n\n`;
        for (const exec of progressData.executives) {
            report += formatInstanceReport(exec, 'executive');
        }
    }
    
    // Managers
    if (progressData.managers.length > 0) {
        report += `## Managers (${progressData.managers.length})\n\n`;
        for (const mgr of progressData.managers) {
            report += formatInstanceReport(mgr, 'manager');
        }
    }
    
    // Specialists
    if (progressData.specialists.length > 0) {
        report += `## Specialists (${progressData.specialists.length})\n\n`;
        for (const spec of progressData.specialists) {
            report += formatInstanceReport(spec, 'specialist');
        }
    }
    
    // Hierarchy
    if (Object.keys(progressData.hierarchy).length > 0) {
        report += `## Instance Hierarchy\n\n`;
        report += '```\n';
        for (const [parent, children] of Object.entries(progressData.hierarchy)) {
            report += `${parent}\n`;
            for (const child of children) {
                report += `  └─ ${child}\n`;
            }
        }
        report += '```\n\n';
    }
    
    return report;
}

/**
 * Format a single instance report
 */
function formatInstanceReport(instance, role) {
    if (instance.error) {
        return `### ${instance.id} ❌\n- Status: ERROR\n- Error: ${instance.error}\n\n`;
    }
    
    const emoji = instance.completionRate === 100 ? '✅' : 
                  instance.progress?.blocked > 0 ? '⚠️' : '🔄';
    
    let report = `### ${instance.id} ${emoji}\n`;
    report += `- Status: ${instance.status}\n`;
    
    if (instance.parentId) {
        report += `- Parent: ${instance.parentId}\n`;
    }
    
    if (instance.branch) {
        report += `- Branch: ${instance.branch}\n`;
    }
    
    if (instance.progress) {
        report += `- Progress: ${instance.progress.completed}/${instance.progress.total} (${instance.completionRate}%)\n`;
        report += `- In Progress: ${instance.progress.inProgress}\n`;
        
        if (instance.progress.blocked > 0) {
            report += `- **BLOCKED: ${instance.progress.blocked} tasks**\n`;
        }
    }
    
    report += '\n';
    return report;
}

/**
 * Monitor for blocked instances and return actionable items
 * @param {Object} tools - MCP tools object
 * @returns {Array} - Array of blocked instances with details
 */
async function findBlockedInstances(tools) {
    const progress = await monitorAllProgress(tools);
    const blocked = [];
    
    // Check all instance types
    const allInstances = [
        ...progress.executives,
        ...progress.managers,
        ...progress.specialists
    ];
    
    for (const instance of allInstances) {
        if (instance.progress?.blocked > 0) {
            const blockedTodos = instance.todos.filter(t => 
                t.content.toLowerCase().includes('blocked') ||
                t.content.toLowerCase().includes('error') ||
                t.content.toLowerCase().includes('failed')
            );
            
            blocked.push({
                instanceId: instance.id,
                role: instance.role,
                parentId: instance.parentId,
                blockedCount: instance.progress.blocked,
                blockedTasks: blockedTodos,
                suggestions: generateBlockerSuggestions(blockedTodos)
            });
        }
    }
    
    return blocked;
}

/**
 * Generate suggestions for resolving blockers
 */
function generateBlockerSuggestions(blockedTodos) {
    const suggestions = [];
    
    for (const todo of blockedTodos) {
        const content = todo.content.toLowerCase();
        
        if (content.includes('permission') || content.includes('access denied')) {
            suggestions.push('Check file permissions and directory access');
        }
        if (content.includes('dependency') || content.includes('missing')) {
            suggestions.push('Verify all dependencies are installed');
        }
        if (content.includes('conflict')) {
            suggestions.push('Check for file conflicts with other specialists');
        }
        if (content.includes('unclear') || content.includes('clarification')) {
            suggestions.push('Provide clearer task specifications');
        }
        if (content.includes('api') || content.includes('endpoint')) {
            suggestions.push('Verify API endpoints and integration points');
        }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
}

/**
 * Check instance health and responsiveness
 * @param {Object} tools - MCP tools object
 * @param {string} instanceId - Instance to check
 * @returns {Object} - Health status
 */
async function checkInstanceHealth(tools, instanceId) {
    try {
        // Send health check
        await tools.send({
            instanceId: instanceId,
            text: "HEALTH_CHECK: Please respond with 'HEALTHY' if you are active and working"
        });
        
        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const response = await tools.read({ instanceId });
        const healthy = response?.messages?.some(m => 
            m.content && m.content.includes('HEALTHY')
        );
        
        // Get progress to check activity
        const progress = await tools.getProgress({ instanceId });
        const lastActivity = progress.todos
            .filter(t => t.timestamp)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        
        return {
            instanceId,
            healthy,
            responsive: healthy,
            lastActivity: lastActivity?.timestamp || null,
            totalTodos: progress.todos.length,
            completedTodos: progress.todos.filter(t => t.status === 'completed').length,
            status: healthy ? 'healthy' : 'unresponsive'
        };
        
    } catch (error) {
        return {
            instanceId,
            healthy: false,
            responsive: false,
            error: error.message,
            status: 'error'
        };
    }
}

export {
    monitorAllProgress,
    generateProgressReport,
    findBlockedInstances,
    checkInstanceHealth
};