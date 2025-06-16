/**
 * Workflow Engine - Core orchestration system for prompt-based workflows
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { spawn } = require('child_process');
const KeywordMonitor = require('./keyword_monitor.cjs');
const ActionExecutor = require('./action_executor.cjs');
const WorkflowContext = require('./workflow_context.cjs');
const { v4: uuidv4 } = require('uuid');

class WorkflowEngine extends EventEmitter {
  constructor(configPath, options = {}) {
    super();
    this.configPath = configPath;
    this.options = options;
    this.context = null;
    this.monitors = new Map();
    this.activeInstances = new Map();
    this.actionExecutor = null;
  }

  async initialize() {
    // Load workflow configuration
    const configContent = await fs.readFile(this.configPath, 'utf8');
    this.config = yaml.parse(configContent);
    
    // Initialize context
    this.context = new WorkflowContext({
      workflow: {
        id: this.config.id || uuidv4(),
        name: this.config.name,
        version: this.config.version,
        run_id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      settings: this.config.settings || {
        poll_interval: 5,
        timeout: 300,
        instance_role: 'specialist',
        workspace_mode: 'isolated'
      }
    });

    // Initialize action executor
    this.actionExecutor = new ActionExecutor(this.context, this.options);
    
    // Set up action executor event handlers
    this.actionExecutor.on('action_complete', (action, result) => {
      this.emit('action_complete', action, result);
    });
    
    this.actionExecutor.on('action_error', (action, error) => {
      this.emit('action_error', action, error);
    });

    console.log(`Initialized workflow: ${this.config.name} (${this.context.get('workflow.run_id')})`);
  }

  async start() {
    await this.initialize();
    
    this.emit('workflow_start', {
      workflow: this.config.name,
      run_id: this.context.get('workflow.run_id')
    });

    try {
      // Execute the first stage
      const firstStage = this.config.stages[0];
      await this.executeStage(firstStage);
    } catch (error) {
      this.emit('workflow_error', error);
      throw error;
    }
  }

  async executeStage(stage) {
    console.log(`\nExecuting stage: ${stage.name || stage.id}`);
    
    // Update context with current stage
    this.context.setStage(stage.id, {
      name: stage.name,
      status: 'running',
      start_time: Date.now()
    });

    this.emit('stage_start', stage);

    try {
      // Check if this stage has a prompt (requires Claude instance)
      if (stage.prompt) {
        // Get or create instance for this stage
        const instanceId = await this.getOrCreateInstance(stage);
        
        // Interpolate prompt with current context
        const interpolatedPrompt = this.context.interpolate(stage.prompt);
        
        // Send the prompt
        await this.actionExecutor.execute({
          action: 'send_prompt',
          target: 'specific_id',
          instance_id: instanceId,
          prompt: interpolatedPrompt
        });

        // Set up keyword monitoring
        if (stage.trigger_keyword) {
          await this.monitorForKeyword(stage, instanceId);
        } else {
          // No keyword to wait for, immediately process success actions
          await this.handleStageSuccess(stage, instanceId, '');
        }
      } else {
        // No prompt - this is an action-only stage, skip Claude interaction
        console.log('Stage has no prompt, executing actions directly');
        await this.handleStageSuccess(stage, null, '');
      }

    } catch (error) {
      console.error(`Stage ${stage.id} failed:`, error);
      this.emit('stage_error', stage, error);
      
      // Execute timeout/failure actions if defined
      if (stage.on_failure) {
        await this.executeActions(stage.on_failure, stage, null);
      }
      
      throw error;
    }
  }

  async monitorForKeyword(stage, instanceId) {
    const monitor = new KeywordMonitor({
      instanceId,
      keyword: stage.trigger_keyword,
      pollInterval: this.context.get('settings.poll_interval'),
      timeout: stage.timeout || this.context.get('settings.timeout')
    });

    // Store monitor for cleanup
    this.monitors.set(`${stage.id}_${instanceId}`, monitor);

    monitor.on('keyword_detected', async (output) => {
      console.log(`Keyword detected for stage ${stage.id}: ${stage.trigger_keyword}`);
      monitor.stop();
      this.monitors.delete(`${stage.id}_${instanceId}`);
      
      await this.handleStageSuccess(stage, instanceId, output);
    });

    monitor.on('timeout', async () => {
      console.log(`Stage ${stage.id} timed out`);
      monitor.stop();
      this.monitors.delete(`${stage.id}_${instanceId}`);
      
      await this.handleStageTimeout(stage, instanceId);
    });

    monitor.on('error', (error) => {
      console.error(`Monitor error for stage ${stage.id}:`, error);
      this.emit('monitor_error', stage, error);
    });

    monitor.start();
  }

  async handleStageSuccess(stage, instanceId, output) {
    // Update stage context
    this.context.updateStage(stage.id, {
      status: 'completed',
      end_time: Date.now(),
      output: output,
      keyword_detected: stage.trigger_keyword
    });

    this.emit('stage_complete', stage);

    // Execute success actions
    if (stage.on_success) {
      await this.executeActions(stage.on_success, stage, instanceId);
    }
  }

  async handleStageTimeout(stage, instanceId) {
    // Update stage context
    this.context.updateStage(stage.id, {
      status: 'timeout',
      end_time: Date.now()
    });

    this.emit('stage_timeout', stage);

    // Execute timeout actions
    if (stage.on_timeout) {
      await this.executeActions(stage.on_timeout, stage, instanceId);
    }
  }

  async executeActions(actions, stage, instanceId) {
    for (const action of actions) {
      try {
        // Check for control flow actions
        if (action.action === 'conditional') {
          await this.executeConditional(action, stage, instanceId);
        } else if (action.action === 'parallel') {
          await this.executeParallel(action, stage, instanceId);
        } else if (action.action === 'foreach') {
          await this.executeForeach(action, stage, instanceId);
        } else if (action.action === 'next_stage') {
          // Pure stage transition action
          const nextStageId = action.next_stage || action.stage_id;
          const nextStage = this.config.stages.find(s => s.id === nextStageId);
          if (nextStage) {
            await this.executeStage(nextStage);
          } else {
            throw new Error(`Stage not found: ${nextStageId}`);
          }
        } else if (action.action === 'complete_workflow') {
          await this.completeWorkflow();
        } else {
          // Regular action - pass current instance context
          const enrichedAction = {
            ...action,
            _stage: stage,
            _instance_id: instanceId
          };
          
          const result = await this.actionExecutor.execute(enrichedAction);
          
          // Store result in context if output_var is specified
          if (action.output_var && result) {
            this.context.set(`actions.${action.output_var}`, result);
          }
          
          // Handle deferred stage transition after successful action execution
          if (action.next_stage) {
            console.log(`Action completed successfully, transitioning to stage: ${action.next_stage}`);
            const nextStage = this.config.stages.find(s => s.id === action.next_stage);
            if (nextStage) {
              await this.executeStage(nextStage);
            } else {
              throw new Error(`Stage not found: ${action.next_stage}`);
            }
          }
        }
      } catch (error) {
        console.error(`Action failed:`, error);
        
        // Handle action failure based on on_failure setting
        if (action.on_failure === 'continue') {
          console.log('Continuing despite action failure');
          continue;
        } else if (action.on_failure === 'retry_once') {
          console.log('Retrying action once');
          try {
            await this.actionExecutor.execute(action);
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            if (action.on_failure !== 'continue') {
              throw retryError;
            }
          }
        } else {
          // Default is abort
          throw error;
        }
      }
    }
  }

  async executeConditional(action, stage, instanceId) {
    const condition = this.context.interpolate(action.condition);
    const result = this.evaluateCondition(condition);
    
    console.log(`Conditional: ${condition} = ${result}`);
    
    const actionsToExecute = result ? action.if_true : action.if_false;
    if (actionsToExecute) {
      await this.executeActions(actionsToExecute, stage, instanceId);
    }
  }

  async executeParallel(action, stage, instanceId) {
    const maxConcurrent = action.max_concurrent || action.actions.length;
    const waitAll = action.wait_all !== false;
    
    console.log(`Executing ${action.actions.length} actions in parallel (max ${maxConcurrent})`);
    
    const promises = action.actions.map(subAction => 
      this.executeActions([subAction], stage, instanceId)
        .catch(error => {
          if (action.continue_on_failure) {
            console.error('Parallel action failed (continuing):', error);
            return null;
          }
          throw error;
        })
    );
    
    if (waitAll) {
      await Promise.all(promises);
    } else {
      // Fire and forget
      promises.forEach(p => p.catch(console.error));
    }
  }

  async executeForeach(action, stage, instanceId) {
    const items = this.context.interpolate(action.items);
    const itemsArray = this.evaluateExpression(items);
    
    console.log(`Executing foreach over ${itemsArray.length} items`);
    
    for (const [index, item] of itemsArray.entries()) {
      // Set item in context
      this.context.set(`vars.${action.item_var}`, item);
      this.context.set('vars._index', index);
      
      await this.executeActions(action.actions, stage, instanceId);
    }
  }

  async getOrCreateInstance(stage) {
    // Check if we should reuse an existing instance
    if (stage.instance_id) {
      return this.context.interpolate(stage.instance_id);
    }
    
    // Check if we have an active instance for this workflow
    if (this.activeInstances.size > 0) {
      return Array.from(this.activeInstances.keys())[0];
    }
    
    // Create a new instance
    const role = stage.instance_role || this.context.get('settings.instance_role');
    const workspaceMode = stage.workspace_mode || this.context.get('settings.workspace_mode');
    
    const spawnResult = await this.actionExecutor.execute({
      action: 'spawn',
      role: role,
      workspace_mode: workspaceMode,
      context: `Workflow: ${this.config.name}\nStage: ${stage.name || stage.id}`
    });
    
    const instanceId = spawnResult.instanceId;
    this.activeInstances.set(instanceId, {
      role,
      stage_id: stage.id,
      created_at: Date.now()
    });
    
    return instanceId;
  }

  evaluateCondition(condition) {
    try {
      // Simple evaluation - in production, use a proper expression evaluator
      // This is a basic implementation for demonstration
      return new Function('context', `
        const ctx = context;
        return ${condition};
      `)(this.context.data);
    } catch (error) {
      console.error('Failed to evaluate condition:', condition, error);
      return false;
    }
  }

  evaluateExpression(expression) {
    try {
      return new Function('context', `
        const ctx = context;
        return ${expression};
      `)(this.context.data);
    } catch (error) {
      console.error('Failed to evaluate expression:', expression, error);
      return [];
    }
  }

  async completeWorkflow() {
    console.log('\nWorkflow completed successfully!');
    
    // Stop all monitors
    for (const monitor of this.monitors.values()) {
      monitor.stop();
    }
    this.monitors.clear();
    
    // Save final state
    await this.context.save();
    
    this.emit('workflow_complete', {
      workflow: this.config.name,
      run_id: this.context.get('workflow.run_id'),
      duration: Date.now() - this.context.get('workflow.start_time'),
      stages: this.context.get('stages')
    });
  }

  async cleanup() {
    // Stop all monitors
    for (const monitor of this.monitors.values()) {
      monitor.stop();
    }
    
    // Optionally terminate instances based on settings
    if (this.config.settings?.cleanup_instances) {
      for (const instanceId of this.activeInstances.keys()) {
        await this.actionExecutor.execute({
          action: 'terminate',
          instance_id: instanceId,
          cascade: true
        });
      }
    }
  }
}

module.exports = WorkflowEngine;