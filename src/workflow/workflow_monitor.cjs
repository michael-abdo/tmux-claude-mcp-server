#!/usr/bin/env node

/**
 * Workflow Monitor - Real-time monitoring dashboard for workflow execution
 * Provides live status updates, performance metrics, and execution visualization
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class WorkflowMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.activeWorkflows = new Map();
    this.metrics = {
      totalWorkflows: 0,
      successfulWorkflows: 0,
      failedWorkflows: 0,
      averageExecutionTime: 0,
      stageCompletionRate: 0
    };
    this.isRunning = false;
  }
  
  start() {
    if (this.isRunning) {
      console.log('⚠️ Monitor already running');
      return;
    }
    
    this.isRunning = true;
    console.log('🔍 Workflow Monitor Started');
    console.log('============================');
    
    // Display initial dashboard
    this.displayDashboard();
    
    // Start periodic updates
    this.updateInterval = setInterval(() => {
      this.updateDashboard();
    }, 5000);
  }
  
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    console.log('\n🛑 Workflow Monitor Stopped');
  }
  
  trackWorkflow(workflowId, workflowInfo) {
    const workflow = {
      id: workflowId,
      name: workflowInfo.name || 'Unknown',
      status: 'running',
      startTime: Date.now(),
      stages: new Map(),
      currentStage: null,
      totalStages: workflowInfo.totalStages || 0,
      completedStages: 0
    };
    
    this.activeWorkflows.set(workflowId, workflow);
    this.metrics.totalWorkflows++;
    
    console.log(`\n🚀 Started: ${workflow.name} (${workflowId})`);
    this.displayWorkflowStatus(workflow);
  }
  
  updateWorkflowStage(workflowId, stageName, status, details = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;
    
    workflow.currentStage = stageName;
    workflow.stages.set(stageName, {
      name: stageName,
      status: status,
      startTime: details.startTime || Date.now(),
      endTime: status === 'completed' ? Date.now() : null,
      ...details
    });
    
    if (status === 'completed') {
      workflow.completedStages++;
    }
    
    const statusIcon = this.getStatusIcon(status);
    console.log(`  ${statusIcon} ${stageName}: ${status}`);
    
    this.emit('stageUpdate', { workflowId, stageName, status, details });
  }
  
  completeWorkflow(workflowId, success = true, error = null) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = success ? 'completed' : 'failed';
    workflow.endTime = Date.now();
    workflow.duration = workflow.endTime - workflow.startTime;
    workflow.error = error;
    
    if (success) {
      this.metrics.successfulWorkflows++;
      console.log(`\n✅ Completed: ${workflow.name} (${Math.round(workflow.duration / 1000)}s)`);
    } else {
      this.metrics.failedWorkflows++;
      console.log(`\n❌ Failed: ${workflow.name} - ${error?.message || 'Unknown error'}`);
    }
    
    this.activeWorkflows.delete(workflowId);
    this.updateMetrics();
    
    this.emit('workflowComplete', { workflowId, workflow, success, error });
  }
  
  displayDashboard() {
    console.clear();
    console.log('🎛️  WORKFLOW MONITORING DASHBOARD');
    console.log('=====================================\n');
    
    this.displayMetrics();
    this.displayActiveWorkflows();
    this.displayRecentActivity();
  }
  
  updateDashboard() {
    if (!this.isRunning) return;
    
    // Only update if there are active workflows or recent changes
    if (this.activeWorkflows.size > 0) {
      this.displayDashboard();
    }
  }
  
  displayMetrics() {
    const successRate = this.metrics.totalWorkflows > 0 
      ? Math.round((this.metrics.successfulWorkflows / this.metrics.totalWorkflows) * 100)
      : 0;
    
    console.log('📊 Metrics:');
    console.log(`   Total Workflows: ${this.metrics.totalWorkflows}`);
    console.log(`   Successful: ${this.metrics.successfulWorkflows}`);
    console.log(`   Failed: ${this.metrics.failedWorkflows}`);
    console.log(`   Success Rate: ${successRate}%`);
    console.log(`   Active: ${this.activeWorkflows.size}`);
    console.log('');
  }
  
  displayActiveWorkflows() {
    if (this.activeWorkflows.size === 0) {
      console.log('🔄 Active Workflows: None\n');
      return;
    }
    
    console.log('🔄 Active Workflows:');
    for (const workflow of this.activeWorkflows.values()) {
      this.displayWorkflowStatus(workflow);
    }
    console.log('');
  }
  
  displayWorkflowStatus(workflow) {
    const duration = Math.round((Date.now() - workflow.startTime) / 1000);
    const progress = workflow.totalStages > 0 
      ? Math.round((workflow.completedStages / workflow.totalStages) * 100)
      : 0;
    
    console.log(`   ${workflow.name}:`);
    console.log(`     Status: ${this.getStatusIcon(workflow.status)} ${workflow.status}`);
    console.log(`     Duration: ${duration}s`);
    console.log(`     Progress: ${workflow.completedStages}/${workflow.totalStages} (${progress}%)`);
    console.log(`     Current: ${workflow.currentStage || 'Not started'}`);
    
    if (workflow.stages.size > 0) {
      console.log(`     Stages:`);
      for (const stage of workflow.stages.values()) {
        const stageIcon = this.getStatusIcon(stage.status);
        console.log(`       ${stageIcon} ${stage.name}`);
      }
    }
    console.log('');
  }
  
  displayRecentActivity() {
    console.log('📝 Recent Activity:');
    console.log('   Monitor started - watching for workflows...\n');
    
    if (this.isRunning) {
      console.log('⏱️  Dashboard updates every 5 seconds');
      console.log('   Press Ctrl+C to stop monitoring\n');
    }
  }
  
  getStatusIcon(status) {
    const icons = {
      'running': '🔄',
      'completed': '✅',
      'failed': '❌',
      'timeout': '⏰',
      'pending': '⏳',
      'error': '💥'
    };
    return icons[status] || '❓';
  }
  
  updateMetrics() {
    // Calculate average execution time
    let totalDuration = 0;
    let completedCount = 0;
    
    // This would normally use historical data, but for demo we'll use current metrics
    if (this.metrics.successfulWorkflows > 0) {
      this.metrics.averageExecutionTime = totalDuration / completedCount || 0;
    }
  }
  
  exportMetrics() {
    return {
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics },
      activeWorkflows: Array.from(this.activeWorkflows.values()),
      systemStatus: this.isRunning ? 'running' : 'stopped'
    };
  }
  
  async saveReport(filePath) {
    const report = this.exportMetrics();
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    console.log(`📋 Monitoring report saved: ${filePath}`);
  }
}

// CLI interface for standalone monitoring
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Workflow Monitor - Real-time workflow execution monitoring

Usage:
  workflow_monitor.cjs [options]

Options:
  --interval <seconds>    Update interval (default: 5)
  --export <file>         Export metrics to JSON file
  --help                  Show this help

Examples:
  workflow_monitor.cjs
  workflow_monitor.cjs --interval 3
  workflow_monitor.cjs --export metrics.json
`);
    return;
  }
  
  const monitor = new WorkflowMonitor({
    updateInterval: args.includes('--interval') 
      ? parseInt(args[args.indexOf('--interval') + 1]) * 1000 
      : 5000
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Shutting down monitor...');
    monitor.stop();
    
    if (args.includes('--export')) {
      const exportFile = args[args.indexOf('--export') + 1] || 'workflow_metrics.json';
      await monitor.saveReport(exportFile);
    }
    
    process.exit(0);
  });
  
  // Start monitoring
  monitor.start();
  
  // Simulate some workflow activity for demo
  if (args.includes('--demo')) {
    setTimeout(() => {
      monitor.trackWorkflow('demo_1', { name: 'Demo Workflow', totalStages: 3 });
      
      setTimeout(() => {
        monitor.updateWorkflowStage('demo_1', 'Initialization', 'completed');
      }, 2000);
      
      setTimeout(() => {
        monitor.updateWorkflowStage('demo_1', 'Processing', 'running');
      }, 4000);
      
      setTimeout(() => {
        monitor.updateWorkflowStage('demo_1', 'Processing', 'completed');
        monitor.updateWorkflowStage('demo_1', 'Finalization', 'running');
      }, 7000);
      
      setTimeout(() => {
        monitor.updateWorkflowStage('demo_1', 'Finalization', 'completed');
        monitor.completeWorkflow('demo_1', true);
      }, 10000);
    }, 3000);
  }
  
  // Keep the process running
  console.log('🎛️ Workflow Monitor running... (Press Ctrl+C to stop)');
}

if (require.main === module) {
  main().catch(error => {
    console.error('Monitor error:', error);
    process.exit(1);
  });
}

module.exports = WorkflowMonitor;