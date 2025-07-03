/**
 * Action Executor - Modern modular action execution system
 */

const EventEmitter = require('events');
const ActionLibrary = require('./actions/index.cjs');

class ActionExecutor extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
    this.options = options;
    
    // Initialize modular action library
    this.actionLibrary = new ActionLibrary(context, options);
    
    // Forward events from action library
    this.actionLibrary.modules.core.on('workflow_complete', () => {
      this.emit('workflow_complete');
    });
  }

  async execute(action) {
    const actionType = action.action;
    
    console.log(`Executing action: ${actionType}`);
    this.emit('action_start', action);
    
    try {
      const result = await this.actionLibrary.execute(action);
      this.emit('action_complete', action, result);
      return result;
    } catch (error) {
      console.error(`Action ${actionType} failed:`, error);
      this.emit('action_error', action, error);
      throw error;
    }
  }
  
  // Delegate to action library
  getAvailableActions() {
    return this.actionLibrary.getAvailableActions();
  }

  getActionDocs(actionType) {
    return this.actionLibrary.getActionDocs(actionType);
  }
  
  async executeAction(action) {
    switch (action.action) {
      case 'spawn':
        return await this.executeSpawn(action);
      
      case 'send_prompt':
      case 'send':
        return await this.executeSend(action);
      
      case 'read_output':
      case 'read':
        return await this.executeRead(action);
      
      case 'list_instances':
      case 'list':
        return await this.executeList(action);
      
      case 'terminate':
        return await this.executeTerminate(action);
      
      case 'wait':
        return await this.executeWait(action);
      
      case 'set_context':
        return await this.executeSetContext(action);
      
      case 'log':
        return await this.executeLog(action);
      
      case 'return_to_blank_state':
        return await this.executeReturnToBlankState(action);
      
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }
  
  async executeSpawn(action) {
    // Fix: Use project directory instead of process.cwd()
    const projectDir = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server';
    const spawnConfig = {
      role: action.role || 'specialist',
      workDir: action.work_dir || projectDir,
      context: this.context.interpolate(action.context || ''),
      workspaceMode: action.workspace_mode || 'isolated'
    };
    
    if (action.parent_id) {
      spawnConfig.parentId = this.context.interpolate(action.parent_id);
    }
    
    console.log(`🚀 Spawning ${spawnConfig.role} instance...`);
    
    const response = await this.callMcpBridge('spawn', spawnConfig);
    
    if (response.success && response.result && response.result.instanceId) {
      const instanceId = response.result.instanceId;
      console.log(`✅ Spawned instance: ${instanceId}`);
      
      // Store in context for later use
      this.context.set(`instances.${spawnConfig.role}`, instanceId);
      this.context.set('vars.current_instance_id', instanceId);
      
      return {
        instanceId: instanceId,
        role: spawnConfig.role,
        success: true
      };
    } else {
      const debugInfo = `Response: ${JSON.stringify(response, null, 2)}`;
      throw new Error(`Failed to spawn instance: ${response.error || response.message || 'Unknown error'}. ${debugInfo}`);
    }
  }
  
  async executeSend(action) {
    let instanceId = action.instance_id;
    
    // Resolve instance ID
    if (!instanceId && action.target === 'current') {
      instanceId = this.context.get('vars.current_instance_id');
    } else if (!instanceId && action._instance_id) {
      instanceId = action._instance_id;
    }
    
    if (!instanceId) {
      throw new Error('No instance ID specified for send action');
    }
    
    instanceId = this.context.interpolate(instanceId);
    const prompt = this.context.interpolate(action.prompt || action.text);
    
    console.log(`📝 Sending prompt to ${instanceId}: ${prompt.slice(0, 100)}...`);
    
    const response = await this.callMcpBridge('send', {
      instanceId: instanceId,
      text: prompt
    });
    
    if (response.success) {
      console.log(`✅ Prompt sent to ${instanceId}`);
      return { success: true, instanceId };
    } else {
      throw new Error(`Failed to send prompt: ${response.error || 'Unknown error'}`);
    }
  }
  
  async executeRead(action) {
    let instanceId = action.instance_id;
    
    if (!instanceId && action.target === 'current') {
      instanceId = this.context.get('vars.current_instance_id');
    } else if (!instanceId && action._instance_id) {
      instanceId = action._instance_id;
    }
    
    if (!instanceId) {
      throw new Error('No instance ID specified for read action');
    }
    
    instanceId = this.context.interpolate(instanceId);
    const lines = action.lines || 20;
    
    const response = await this.callMcpBridge('read', {
      instanceId: instanceId,
      lines: lines
    });
    
    if (response.success) {
      return {
        success: true,
        instanceId: instanceId,
        output: response.output || '',
        timestamp: Date.now()
      };
    } else {
      throw new Error(`Failed to read output: ${response.error || 'Unknown error'}`);
    }
  }
  
  async executeList(action) {
    const response = await this.callMcpBridge('list', {});
    
    if (response.success) {
      console.log(`📋 Found ${response.instances ? response.instances.length : 0} active instances`);
      return {
        success: true,
        instances: response.instances || [],
        count: response.instances ? response.instances.length : 0
      };
    } else {
      throw new Error(`Failed to list instances: ${response.error || 'Unknown error'}`);
    }
  }
  
  async executeTerminate(action) {
    let instanceId = action.instance_id;
    
    if (!instanceId && action.target === 'current') {
      instanceId = this.context.get('vars.current_instance_id');
    } else if (!instanceId && action._instance_id) {
      instanceId = action._instance_id;
    }
    
    if (!instanceId) {
      throw new Error('No instance ID specified for terminate action');
    }
    
    instanceId = this.context.interpolate(instanceId);
    
    console.log(`🗑️ Terminating instance: ${instanceId}`);
    
    const response = await this.callMcpBridge('terminate', {
      instanceId: instanceId
    });
    
    if (response.success) {
      console.log(`✅ Terminated instance: ${instanceId}`);
      return { success: true, instanceId };
    } else {
      throw new Error(`Failed to terminate instance: ${response.error || 'Unknown error'}`);
    }
  }
  
  async executeWait(action) {
    const duration = action.duration || action.seconds || 1;
    console.log(`⏱️ Waiting ${duration} seconds...`);
    
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
    return { success: true, duration };
  }
  
  async executeSetContext(action) {
    const key = this.context.interpolate(action.key);
    const value = this.context.interpolate(action.value);
    
    this.context.set(key, value);
    
    if (this.debug) {
      console.log(`📝 Context set: ${key} = ${value}`);
    }
    
    return { success: true, key, value };
  }
  
  async executeLog(action) {
    const message = this.context.interpolate(action.message);
    const level = action.level || 'info';
    
    switch (level) {
      case 'error':
        console.error(`❌ ${message}`);
        break;
      case 'warn':
        console.warn(`⚠️ ${message}`);
        break;
      case 'debug':
        if (this.debug) {
          console.log(`🐛 ${message}`);
        }
        break;
      default:
        console.log(`ℹ️ ${message}`);
    }
    
    return { success: true, message, level };
  }
  
  async executeReturnToBlankState(action) {
    let instanceId = action.instance_id;
    
    // Resolve instance ID
    if (!instanceId && action.target === 'current') {
      instanceId = this.context.get('vars.current_instance_id');
    } else if (!instanceId && action._instance_id) {
      instanceId = action._instance_id;
    }
    
    if (!instanceId) {
      throw new Error('No instance ID specified for return_to_blank_state action');
    }
    
    instanceId = this.context.interpolate(instanceId);
    
    console.log(`🔄 Returning ${instanceId} to blank state - ready for new human input`);
    
    // Optional: Send a message to the instance to indicate it's ready
    const blankStateMessage = action.message || 
      "✅ Workflow complete. Ready for your next command.";
    
    if (action.send_message !== false) {
      try {
        await this.callMcpBridge('send', {
          instanceId: instanceId,
          text: blankStateMessage
        });
        console.log(`📝 Sent blank state message to ${instanceId}`);
      } catch (error) {
        console.warn(`⚠️ Failed to send blank state message: ${error.message}`);
        // Don't fail the action if message sending fails
      }
    }
    
    // Reset workflow context variables for this instance
    this.context.set(`instances.${instanceId}.state`, 'blank');
    this.context.set(`instances.${instanceId}.ready_for_input`, true);
    this.context.set(`instances.${instanceId}.last_blank_time`, Date.now());
    
    return {
      success: true,
      instanceId: instanceId,
      state: 'blank',
      message: 'Instance returned to blank state'
    };
  }
  
  findMcpBridge() {
    // Try multiple locations for the MCP bridge script
    const possiblePaths = [
      path.resolve(__dirname, '../../scripts/mcp_bridge.js'),  // Fixed: Go up 2 levels from workflow/
      path.resolve(process.cwd(), 'scripts/mcp_bridge.js'),
      path.resolve(process.cwd(), 'src/scripts/mcp_bridge.js'),
      '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/scripts/mcp_bridge.js'  // Fixed: Correct path
    ];
    
    for (const bridgePath of possiblePaths) {
      if (require('fs').existsSync(bridgePath)) {
        return bridgePath;
      }
    }
    
    // Fallback to relative path from workflow directory
    return path.resolve(__dirname, '../../scripts/mcp_bridge.js');  // Fixed: Go up 2 levels
  }

  async callMcpBridge(command, params) {
    return new Promise((resolve, reject) => {
      const nodeCommand = 'node';
      const args = [
        this.mcpBridgePath,
        command,
        JSON.stringify(params)
      ];
      
      console.log(`🔌 MCP Bridge: ${command}`, params);
      console.log(`📍 MCP bridge path: ${this.mcpBridgePath}`);
      console.log(`📍 Full command: ${nodeCommand} ${args.join(' ')}`);
      
      // Set working directory to the project root
      const workingDir = path.dirname(this.mcpBridgePath);
      
      const process = spawn(nodeCommand, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: workingDir  // Fix: Set correct working directory
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`📤 MCP Bridge stdout: ${output.trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        const error = data.toString();
        stderr += error;
        console.log(`📤 MCP Bridge stderr: ${error.trim()}`);
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`MCP bridge command failed: ${stderr || 'Unknown error'}`));
          return;
        }
        
        try {
          // Extract JSON from potentially mixed output
          const lines = stdout.trim().split('\n');
          let jsonResponse = null;
          
          // Try to find valid JSON in the output
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              jsonResponse = JSON.parse(lines[i]);
              break;
            } catch (e) {
              // Continue looking
            }
          }
          
          if (!jsonResponse) {
            throw new Error('No valid JSON response found');
          }
          
          resolve(jsonResponse);
        } catch (error) {
          reject(new Error(`Failed to parse MCP bridge response: ${error.message}\nOutput: ${stdout}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`MCP bridge process error: ${error.message}`));
      });
      
      // Set timeout for MCP operations
      // Longer timeout for spawn operations which may need authentication
      const timeout = command === 'spawn' ? 180000 : 60000; // 3 minutes for spawn, 1 minute for others
      setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`MCP bridge timeout for command: ${command}`));
      }, timeout);
    });
  }
}

module.exports = ActionExecutor;