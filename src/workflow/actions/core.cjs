/**
 * Core workflow actions - Essential actions for all workflows
 */

const EventEmitter = require('events');
const MCPBridge = require('../mcp_bridge.cjs');

class CoreActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
    this.bridge = options.bridge || new MCPBridge();
  }

  /**
   * Send a prompt to a Claude instance
   */
  async send_prompt(action) {
    let instanceId = action.instance_id;
    
    // Determine target instance
    if (action.target === 'same_instance') {
      instanceId = action._instance_id || this.context.get('instance.id');
    } else if (action.target === 'new_instance') {
      // Spawn new instance first
      const spawnResult = await this.spawn({
        role: action.role || 'specialist',
        workspace_mode: action.workspace_mode,
        context: action.spawn_context || `Workflow: ${this.context.get('workflow.name')}`
      });
      instanceId = spawnResult.instanceId;
    } else if (action.target === 'specific_id') {
      instanceId = this.context.interpolate(action.instance_id);
    }
    
    if (!instanceId) {
      throw new Error('No instance ID specified for send_prompt');
    }
    
    // Interpolate prompt
    const prompt = this.context.interpolate(action.prompt);
    
    // Send the prompt
    const result = await this.bridge.send({
      instanceId,
      text: prompt
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to send prompt');
    }
    
    // Handle wait_for_keyword if specified
    if (action.wait_for_keyword) {
      const KeywordMonitor = require('../keyword_monitor.cjs');
      const monitor = new KeywordMonitor({
        instanceId,
        keyword: action.wait_for_keyword,
        timeout: action.timeout || 300,
        bridge: this.bridge
      });
      
      return new Promise((resolve, reject) => {
        monitor.on('keyword_detected', (output, keyword) => {
          monitor.stop();
          
          // Extract pattern if specified
          if (action.extract_pattern) {
            const regex = new RegExp(action.extract_pattern, 's');
            const match = output.match(regex);
            if (match && action.extract_var) {
              this.context.set(`actions.${action.extract_var}`, match[1] || match[0]);
            }
          }
          
          resolve({ success: true, output, keyword });
        });
        
        monitor.on('timeout', () => {
          monitor.stop();
          reject(new Error(`Timeout waiting for keyword: ${action.wait_for_keyword}`));
        });
        
        monitor.on('error', (error) => {
          monitor.stop();
          reject(error);
        });
        
        monitor.start();
      });
    }
    
    return { success: true, instanceId };
  }

  /**
   * Spawn a new Claude instance
   */
  async spawn(action) {
    const result = await this.bridge.spawn({
      role: action.role || 'specialist',
      workDir: action.work_dir || process.cwd(),
      context: this.context.interpolate(action.context || ''),
      parentId: action.parent_id || this.context.get('instance.id'),
      workspaceMode: action.workspace_mode
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to spawn instance');
    }
    
    return result;
  }

  /**
   * Terminate a Claude instance
   */
  async terminate(action) {
    const instanceId = this.context.interpolate(action.instance_id || action._instance_id);
    
    const result = await this.bridge.terminate({
      instanceId,
      cascade: action.cascade !== false
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to terminate instance');
    }
    
    return result;
  }

  /**
   * Log a message
   */
  async log(action) {
    const message = this.context.interpolate(action.message);
    const level = action.level || 'info';
    
    console[level](`[WORKFLOW LOG] ${message}`);
    
    return { message, level, timestamp: new Date().toISOString() };
  }

  /**
   * Wait for specified time
   */
  async wait(action) {
    const seconds = action.seconds || 1;
    console.log(`Waiting ${seconds} seconds...`);
    
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    
    return { waited: seconds };
  }

  /**
   * Set a variable in context
   */
  async set_var(action) {
    const name = action.name;
    const value = this.context.interpolate(action.value);
    
    this.context.set(`vars.${name}`, value);
    
    return { name, value };
  }

  /**
   * Complete the workflow
   */
  async complete_workflow(action) {
    this.emit('workflow_complete');
    return { completed: true };
  }
}

module.exports = CoreActions;