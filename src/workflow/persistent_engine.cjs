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
      // For persistent workflows, start by spawning an instance and going to blank state
      await this.startPersistentWorkflow();
    } catch (error) {
      this.emit('workflow_error', error);
      throw error;
    }
  }

  async startPersistentWorkflow() {
    console.log('🔄 Starting persistent workflow - spawning instance and entering blank state...');
    
    // Spawn an instance for this persistent workflow
    const spawnResult = await this.actionExecutor.execute({
      action: 'spawn',
      role: this.context.get('settings.instance_role') || 'specialist',
      workspace_mode: this.context.get('settings.workspace_mode') || 'isolated',
      context: `Persistent Workflow: ${this.config.name}\nReady for EXECUTE_FINISHED commands`
    });
    
    const instanceId = spawnResult.instanceId;
    this.activeInstances.set(instanceId, {
      role: this.context.get('settings.instance_role') || 'specialist',
      stage_id: 'persistent_blank',
      created_at: Date.now(),
      persistent: true
    });
    
    // Store instance ID in context
    this.context.set('vars.current_instance_id', instanceId);
    
    // Send initial blank state message
    await this.actionExecutor.execute({
      action: 'return_to_blank_state',
      instance_id: instanceId,
      message: '🎯 Persistent workflow ready! Give me a command ending with "SAY EXECUTE_FINISHED" and I\'ll automatically execute the compare→commit cycle.',
      send_message: true
    });
    
    // Start persistent monitoring for EXECUTE_FINISHED
    await this.startPersistentMonitoring(instanceId);
    
    console.log(`✅ Persistent workflow started on instance ${instanceId}`);
    console.log(`📋 Ready for commands ending with "SAY EXECUTE_FINISHED"`);
  }

  async executeStage(stage, existingInstanceId = null) {
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
        const instanceId = existingInstanceId || await this.getOrCreateInstance(stage);
        
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

    // Use new error recovery system
    await this.handleWorkflowTimeout(stage.id, instanceId);
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
          // Pure stage transition action - reuse current instance
          const nextStageId = action.next_stage || action.stage_id;
          const nextStage = this.config.stages.find(s => s.id === nextStageId);
          if (nextStage) {
            await this.executeStage(nextStage, instanceId);
          } else {
            throw new Error(`Stage not found: ${nextStageId}`);
          }
        } else if (action.action === 'complete_workflow') {
          await this.completeWorkflow();
        } else if (action.action === 'return_to_blank_state') {
          await this.returnToBlankState(instanceId);
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
              await this.executeStage(nextStage, instanceId);
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

  async returnToBlankState(instanceId) {
    console.log(`🔄 Returning to blank state - ready for next EXECUTE_FINISHED trigger`);
    
    // Stop current monitors but don't stop the engine
    for (const monitor of this.monitors.values()) {
      monitor.stop();
    }
    this.monitors.clear();
    
    // Set up persistent monitoring for EXECUTE_FINISHED
    console.log(`👂 Starting persistent monitor for EXECUTE_FINISHED on ${instanceId}`);
    await this.startPersistentMonitoring(instanceId);
    
    this.emit('blank_state_ready', {
      instanceId,
      timestamp: Date.now(),
      message: 'Ready for next EXECUTE_FINISHED command'
    });
  }

  async startPersistentMonitoring(instanceId) {
    const KeywordMonitor = require('./keyword_monitor.cjs');
    
    const monitor = new KeywordMonitor({
      instanceId: instanceId,
      keyword: 'EXECUTE_FINISHED',
      pollInterval: 2, // Poll every 2 seconds
      timeout: 0, // No timeout - monitor forever
      simpleMode: true // Use simple keyword detection
    });

    monitor.on('keyword_detected', async (output) => {
      console.log(`🎯 EXECUTE_FINISHED detected! Starting new workflow cycle...`);
      
      // Stop the persistent monitor
      monitor.stop();
      
      // Start a new workflow cycle from compare stage
      // User has already executed their command and said EXECUTE_FINISHED
      try {
        console.log(`🔄 EXECUTE_FINISHED detected! Proceeding to compare stage...`);
        const compareStage = this.config.stages.find(s => s.id === 'compare_stage');
        if (compareStage) {
          // Store the instance ID for the entire cycle
          this.context.set('vars.current_instance_id', instanceId);
          await this.executeStage(compareStage, instanceId);
        } else {
          throw new Error('compare_stage not found in workflow configuration');
        }
      } catch (error) {
        console.error(`❌ Error in workflow cycle:`, error);
        // Restart persistent monitoring even if there's an error
        await this.startPersistentMonitoring(instanceId);
      }
    });

    monitor.on('error', async (error) => {
      console.error(`❌ Monitor error:`, error);
      await this.handleMonitorError(instanceId, error);
      // Restart monitoring on error
      setTimeout(() => {
        this.startPersistentMonitoring(instanceId);
      }, 5000);
    });

    this.monitors.set('persistent_execute', monitor);
    monitor.start();
  }

  // Error Recovery System
  async handleMonitorError(instanceId, error) {
    console.log(`🚨 Handling monitor error for ${instanceId}: ${error.message}`);
    
    // Emit error event for external handling
    this.emit('monitor_error', {
      instanceId,
      error: error.message,
      timestamp: Date.now(),
      recovery_action: 'restart_monitoring'
    });
    
    // Check if instance is still alive
    const instanceAlive = await this.checkInstanceHealth(instanceId);
    if (!instanceAlive) {
      console.log(`💀 Instance ${instanceId} appears dead, attempting recovery...`);
      await this.handleDeadInstance(instanceId);
    }
  }

  async handleWorkflowTimeout(stageId, instanceId) {
    console.log(`⏰ Workflow timeout detected for stage ${stageId} on ${instanceId}`);
    
    // Emit timeout event
    this.emit('workflow_timeout', {
      stageId,
      instanceId,
      timestamp: Date.now(),
      action: 'attempting_recovery'
    });
    
    // Try to recover the workflow
    try {
      // Stop current stage monitoring
      const monitorKey = `${stageId}_${instanceId}`;
      if (this.monitors.has(monitorKey)) {
        this.monitors.get(monitorKey).stop();
        this.monitors.delete(monitorKey);
      }
      
      // Send a recovery prompt to the instance
      await this.sendRecoveryPrompt(instanceId, stageId);
      
      // Restart monitoring with extended timeout
      await this.retryStageWithRecovery(stageId, instanceId);
      
    } catch (error) {
      console.error(`❌ Recovery failed for ${stageId}:`, error);
      // Fall back to blank state
      await this.returnToBlankState(instanceId);
    }
  }

  async sendRecoveryPrompt(instanceId, stageId) {
    const recoveryPrompts = {
      compare_stage: "I notice you may not have completed the comparison. Please analyze the directory listing and type COMPARE_FINISHED when done.",
      commit_stage: "Please complete the git status analysis and type COMMIT_FINISHED when ready.",
      execute_stage: "Please complete your task and type EXECUTE_FINISHED when done."
    };
    
    const prompt = recoveryPrompts[stageId] || "Please complete your current task and say the appropriate FINISHED keyword.";
    
    try {
      await this.actionExecutor.execute({
        action: 'send',
        instance_id: instanceId,
        text: `\n🔄 Recovery: ${prompt}`
      });
      console.log(`📤 Sent recovery prompt to ${instanceId} for ${stageId}`);
    } catch (error) {
      console.error(`❌ Failed to send recovery prompt:`, error);
    }
  }

  async retryStageWithRecovery(stageId, instanceId) {
    const stage = this.config.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} not found for recovery`);
    }
    
    // Extend timeout for recovery attempt
    const originalTimeout = stage.timeout;
    stage.timeout = (originalTimeout || 60) + 30; // Add 30 seconds
    
    console.log(`🔄 Retrying stage ${stageId} with extended timeout`);
    
    // Re-execute the stage
    await this.executeStage(stage, instanceId);
    
    // Restore original timeout
    stage.timeout = originalTimeout;
  }

  async checkInstanceHealth(instanceId) {
    try {
      const response = await this.actionExecutor.execute({
        action: 'read',
        instance_id: instanceId,
        lines: 1
      });
      return response && response.success;
    } catch (error) {
      console.log(`💀 Instance health check failed for ${instanceId}: ${error.message}`);
      return false;
    }
  }

  async handleDeadInstance(instanceId) {
    console.log(`🚑 Attempting to recover dead instance ${instanceId}`);
    
    // Emit dead instance event
    this.emit('instance_dead', {
      instanceId,
      timestamp: Date.now(),
      recovery_action: 'spawn_replacement'
    });
    
    try {
      // Try to terminate the dead instance
      await this.actionExecutor.execute({
        action: 'terminate',
        instance_id: instanceId,
        force: true
      });
    } catch (error) {
      console.log(`⚠️ Could not terminate dead instance: ${error.message}`);
    }
    
    // Spawn a replacement instance
    try {
      const spawnResult = await this.actionExecutor.execute({
        action: 'spawn',
        role: 'specialist',
        workspace_mode: 'isolated',
        context: 'Replacement instance for persistent workflow'
      });
      
      const newInstanceId = spawnResult.instanceId;
      console.log(`✅ Spawned replacement instance: ${newInstanceId}`);
      
      // Update context and restart monitoring
      this.context.set('vars.current_instance_id', newInstanceId);
      await this.returnToBlankState(newInstanceId);
      
      return newInstanceId;
    } catch (error) {
      console.error(`❌ Failed to spawn replacement instance:`, error);
      this.emit('workflow_fatal_error', {
        originalInstanceId: instanceId,
        error: error.message,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  async handleStuckWorkflow(instanceId, stageId, duration) {
    console.log(`🔒 Workflow appears stuck on stage ${stageId} for ${duration}ms`);
    
    this.emit('workflow_stuck', {
      instanceId,
      stageId,
      duration,
      timestamp: Date.now()
    });
    
    // Send a gentle nudge to the instance
    await this.sendRecoveryPrompt(instanceId, stageId);
    
    // If still stuck after nudge, force recovery
    setTimeout(async () => {
      console.log(`🔨 Force-recovering stuck workflow on ${instanceId}`);
      await this.handleWorkflowTimeout(stageId, instanceId);
    }, 30000); // Wait 30 seconds before force recovery
  }

  async detectWorkflowConflicts() {
    // Check for multiple instances trying to write to same directory
    const activeInstances = Array.from(this.activeInstances.values());
    const workingDirectories = new Map();
    
    for (const instance of activeInstances) {
      const workDir = instance.workDir || process.cwd();
      if (workingDirectories.has(workDir)) {
        console.warn(`⚠️ Multiple instances detected in same directory: ${workDir}`);
        this.emit('workflow_conflict', {
          directory: workDir,
          instances: [workingDirectories.get(workDir), instance.instanceId],
          timestamp: Date.now()
        });
      } else {
        workingDirectories.set(workDir, instance.instanceId);
      }
    }
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