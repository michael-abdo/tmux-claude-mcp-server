#!/usr/bin/env node

/**
 * Workflow Manager - Central utility for managing and running workflows
 * Provides workflow discovery, execution, and monitoring capabilities
 */

const fs = require('fs').promises;
const path = require('path');
const WorkflowEngine = require('./workflow_engine.cjs');
const { spawn } = require('child_process');

class WorkflowManager {
  constructor(options = {}) {
    this.workflowsDir = options.workflowsDir || 
      path.resolve(__dirname, '../../workflows');
    this.debug = options.debug || false;
  }
  
  async discoverWorkflows() {
    const workflows = [];
    
    try {
      const examplesDir = path.join(this.workflowsDir, 'examples');
      const files = await fs.readdir(examplesDir);
      
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const filePath = path.join(examplesDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          
          // Extract metadata from YAML
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          const versionMatch = content.match(/^version:\s*(.+)$/m);
          
          workflows.push({
            id: path.basename(file, path.extname(file)),
            name: nameMatch ? nameMatch[1].trim() : file,
            description: descMatch ? descMatch[1].trim() : 'No description',
            version: versionMatch ? versionMatch[1].trim() : '1.0',
            path: filePath,
            file: file
          });
        }
      }
    } catch (error) {
      console.error('Error discovering workflows:', error.message);
    }
    
    return workflows;
  }
  
  async listWorkflows() {
    const workflows = await this.discoverWorkflows();
    
    console.log('\n📋 Available Workflows:');
    console.log('=====================\n');
    
    workflows.forEach((workflow, index) => {
      console.log(`${index + 1}. ${workflow.name} (v${workflow.version})`);
      console.log(`   Description: ${workflow.description}`);
      console.log(`   File: ${workflow.file}`);
      console.log('');
    });
    
    return workflows;
  }
  
  async runWorkflow(workflowId, options = {}) {
    const workflows = await this.discoverWorkflows();
    const workflow = workflows.find(w => 
      w.id === workflowId || 
      w.name.toLowerCase().includes(workflowId.toLowerCase()) ||
      w.file === workflowId
    );
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    console.log(`🚀 Running workflow: ${workflow.name}`);
    console.log(`📁 File: ${workflow.file}`);
    console.log(`📝 Description: ${workflow.description}\n`);
    
    const engine = new WorkflowEngine(workflow.path, {
      debug: options.debug || this.debug,
      ...options
    });
    
    // Set up monitoring
    this.setupWorkflowMonitoring(engine, workflow);
    
    try {
      await engine.start();
      
      if (options.cleanup !== false) {
        await engine.cleanup();
      }
      
      console.log(`\n✅ Workflow completed: ${workflow.name}`);
      return { success: true, workflow };
      
    } catch (error) {
      console.error(`\n❌ Workflow failed: ${workflow.name}`);
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }
  
  setupWorkflowMonitoring(engine, workflow) {
    engine.on('workflow_start', (data) => {
      console.log(`🎬 Started: ${data.workflow} (${data.run_id})`);
    });
    
    engine.on('stage_start', (stage) => {
      console.log(`🔄 Stage: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_complete', (stage) => {
      console.log(`✅ Completed: ${stage.name || stage.id}`);
    });
    
    engine.on('stage_timeout', (stage) => {
      console.log(`⏰ Timeout: ${stage.name || stage.id}`);
    });
    
    engine.on('action_complete', (action, result) => {
      if (this.debug) {
        console.log(`  ✓ ${action.action}:`, result ? JSON.stringify(result).slice(0, 50) + '...' : '');
      }
    });
    
    engine.on('action_error', (action, error) => {
      console.log(`  ❌ ${action.action}: ${error.message}`);
    });
    
    engine.on('workflow_complete', (data) => {
      const duration = Math.round(data.duration / 1000);
      console.log(`🎉 Completed in ${duration}s with ${Object.keys(data.stages).length} stages`);
    });
    
    engine.on('workflow_error', (error) => {
      console.error(`💥 Failed: ${error.message}`);
    });
  }
  
  async validateWorkflow(workflowPath) {
    try {
      const content = await fs.readFile(workflowPath, 'utf8');
      const yaml = require('yaml');
      const config = yaml.parse(content);
      
      const errors = [];
      
      // Basic validation
      if (!config.name) errors.push('Missing required field: name');
      if (!config.stages || !Array.isArray(config.stages)) {
        errors.push('Missing or invalid stages array');
      }
      
      // Stage validation
      if (config.stages) {
        config.stages.forEach((stage, index) => {
          if (!stage.id) errors.push(`Stage ${index}: missing id`);
          if (!stage.name) errors.push(`Stage ${index}: missing name`);
        });
      }
      
      return { valid: errors.length === 0, errors };
    } catch (error) {
      return { valid: false, errors: [`Failed to parse workflow: ${error.message}`] };
    }
  }
  
  async createWorkflowTemplate(name, options = {}) {
    const template = {
      name: name,
      description: options.description || 'Auto-generated workflow',
      version: '1.0',
      settings: {
        useTaskIds: false,
        poll_interval: 5,
        timeout: 120,
        instance_role: 'specialist',
        workspace_mode: 'isolated'
      },
      stages: [
        {
          id: 'main_stage',
          name: 'Main Task',
          prompt: 'Please complete the assigned task.\n\nWhen done, respond with: TASK_COMPLETE',
          trigger_keyword: 'TASK_COMPLETE',
          timeout: 60,
          on_success: [
            { action: 'complete_workflow' }
          ]
        }
      ]
    };
    
    const yaml = require('yaml');
    const yamlContent = yaml.stringify(template);
    
    if (options.save) {
      const filename = name.toLowerCase().replace(/\s+/g, '_') + '.yaml';
      const filepath = path.join(this.workflowsDir, 'examples', filename);
      await fs.writeFile(filepath, yamlContent);
      console.log(`📄 Template saved: ${filepath}`);
      return filepath;
    }
    
    return yamlContent;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const manager = new WorkflowManager({ debug: args.includes('--debug') });
  
  try {
    if (args.length === 0 || args.includes('--help')) {
      console.log(`
Workflow Manager - Manage and run YAML-based workflows

Usage:
  workflow_manager.cjs list                     List all available workflows
  workflow_manager.cjs run <workflow-id>        Run a specific workflow
  workflow_manager.cjs validate <file.yaml>     Validate a workflow file
  workflow_manager.cjs create <name>            Create a workflow template
  
Options:
  --debug                                       Enable debug output
  --no-cleanup                                  Don't cleanup instances after completion
  --help                                        Show this help

Examples:
  workflow_manager.cjs list
  workflow_manager.cjs run quick_analysis --debug
  workflow_manager.cjs validate my_workflow.yaml
  workflow_manager.cjs create "My New Workflow"
`);
      return;
    }
    
    const command = args[0];
    
    switch (command) {
      case 'list':
        await manager.listWorkflows();
        break;
        
      case 'run':
        if (args.length < 2) {
          console.error('❌ Please specify a workflow to run');
          process.exit(1);
        }
        const workflowId = args[1];
        const options = {
          debug: args.includes('--debug'),
          cleanup: !args.includes('--no-cleanup')
        };
        await manager.runWorkflow(workflowId, options);
        break;
        
      case 'validate':
        if (args.length < 2) {
          console.error('❌ Please specify a workflow file to validate');
          process.exit(1);
        }
        const validation = await manager.validateWorkflow(args[1]);
        if (validation.valid) {
          console.log('✅ Workflow is valid');
        } else {
          console.log('❌ Workflow validation failed:');
          validation.errors.forEach(error => console.log(`  - ${error}`));
          process.exit(1);
        }
        break;
        
      case 'create':
        if (args.length < 2) {
          console.error('❌ Please specify a workflow name');
          process.exit(1);
        }
        const template = await manager.createWorkflowTemplate(args[1], { save: true });
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error('Use --help for usage information');
        process.exit(1);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (args.includes('--debug')) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = WorkflowManager;