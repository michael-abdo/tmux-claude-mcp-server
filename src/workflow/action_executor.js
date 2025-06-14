/**
 * Action Executor - Executes workflow actions with context
 */

const EventEmitter = require('events');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const MCPBridge = require('../mcp_bridge');
const axios = require('axios');
const { promisify } = require('util');
const execAsync = promisify(exec);

class ActionExecutor extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
    this.options = options;
    this.bridge = options.bridge || new MCPBridge();
    
    // Action handlers
    this.handlers = {
      'send_prompt': this.handleSendPrompt.bind(this),
      'run_script': this.handleRunScript.bind(this),
      'spawn': this.handleSpawn.bind(this),
      'terminate': this.handleTerminate.bind(this),
      'save_file': this.handleSaveFile.bind(this),
      'read_file': this.handleReadFile.bind(this),
      'http_request': this.handleHttpRequest.bind(this),
      'log': this.handleLog.bind(this),
      'wait': this.handleWait.bind(this),
      'set_var': this.handleSetVar.bind(this),
      'transform': this.handleTransform.bind(this),
      'template': this.handleTemplate.bind(this)
    };
  }

  async execute(action) {
    const actionType = action.action;
    const handler = this.handlers[actionType];
    
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }
    
    console.log(`Executing action: ${actionType}`);
    this.emit('action_start', action);
    
    try {
      const result = await handler(action);
      this.emit('action_complete', action, result);
      return result;
    } catch (error) {
      console.error(`Action ${actionType} failed:`, error);
      this.emit('action_error', action, error);
      throw error;
    }
  }

  async handleSendPrompt(action) {
    let instanceId = action.instance_id;
    
    // Determine target instance
    if (action.target === 'same_instance') {
      instanceId = action._instance_id || this.context.get('instance.id');
    } else if (action.target === 'new_instance') {
      // Spawn new instance first
      const spawnResult = await this.handleSpawn({
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
      const KeywordMonitor = require('./keyword_monitor');
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

  async handleRunScript(action) {
    const script = this.context.interpolate(action.script);
    const args = (action.args || []).map(arg => this.context.interpolate(arg));
    const env = action.env ? this.interpolateObject(action.env) : process.env;
    const workingDir = action.working_dir || process.cwd();
    const timeout = (action.timeout || 300) * 1000;
    
    console.log(`Running script: ${script} ${args.join(' ')}`);
    
    // Determine where to run the script
    if (action.target === 'instance') {
      // Run inside Claude instance
      const instanceId = action.instance_id || action._instance_id || this.context.get('instance.id');
      
      // Construct command to run in instance
      const command = [script, ...args].join(' ');
      const wrappedPrompt = `
Run this command and report the results:
\`\`\`bash
cd ${workingDir}
${command}
\`\`\`

Report the exit code and any output.
When done, say ***SCRIPT_COMPLETE***`;
      
      const result = await this.handleSendPrompt({
        target: 'specific_id',
        instance_id: instanceId,
        prompt: wrappedPrompt,
        wait_for_keyword: '***SCRIPT_COMPLETE***',
        timeout: action.timeout
      });
      
      return {
        stdout: result.output,
        stderr: '',
        exit_code: 0 // We'd need to parse this from Claude's response
      };
      
    } else {
      // Run locally
      return new Promise((resolve, reject) => {
        const child = spawn(script, args, {
          env,
          cwd: workingDir,
          shell: true
        });
        
        let stdout = '';
        let stderr = '';
        let timedOut = false;
        
        // Set timeout
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill('SIGTERM');
        }, timeout);
        
        // Capture output
        child.stdout.on('data', (data) => {
          stdout += data.toString();
          if (action.stdin && this.context.has(`actions.${action.stdin}`)) {
            child.stdin.write(this.context.get(`actions.${action.stdin}`));
            child.stdin.end();
          }
        });
        
        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        child.on('close', (code) => {
          clearTimeout(timer);
          
          if (timedOut) {
            reject(new Error(`Script timed out after ${timeout}ms`));
            return;
          }
          
          const result = {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exit_code: code
          };
          
          // Check expected exit code
          if (action.expect_exit_code !== undefined && code !== action.expect_exit_code) {
            reject(new Error(`Script exited with code ${code}, expected ${action.expect_exit_code}`));
          } else {
            resolve(result);
          }
        });
        
        child.on('error', reject);
      });
    }
  }

  async handleSpawn(action) {
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

  async handleTerminate(action) {
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

  async handleSaveFile(action) {
    const filePath = this.context.interpolate(action.path);
    const content = this.context.interpolate(action.content);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    // Write file
    await fs.writeFile(filePath, content, 'utf8');
    
    console.log(`Saved file: ${filePath}`);
    return { path: filePath, size: content.length };
  }

  async handleReadFile(action) {
    const filePath = this.context.interpolate(action.path);
    const content = await fs.readFile(filePath, 'utf8');
    
    return { content, path: filePath };
  }

  async handleHttpRequest(action) {
    const config = {
      method: action.method || 'GET',
      url: this.context.interpolate(action.url),
      headers: action.headers ? this.interpolateObject(action.headers) : {},
      timeout: (action.timeout || 30) * 1000
    };
    
    if (action.body) {
      config.data = this.interpolateObject(action.body);
    }
    
    try {
      const response = await axios(config);
      return {
        status: response.status,
        headers: response.headers,
        body: response.data
      };
    } catch (error) {
      if (error.response) {
        return {
          status: error.response.status,
          headers: error.response.headers,
          body: error.response.data,
          error: true
        };
      }
      throw error;
    }
  }

  async handleLog(action) {
    const message = this.context.interpolate(action.message);
    const level = action.level || 'info';
    
    console[level](`[WORKFLOW LOG] ${message}`);
    
    return { message, level, timestamp: new Date().toISOString() };
  }

  async handleWait(action) {
    const seconds = action.seconds || 1;
    console.log(`Waiting ${seconds} seconds...`);
    
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    
    return { waited: seconds };
  }

  async handleSetVar(action) {
    const name = action.name;
    const value = this.context.interpolate(action.value);
    
    this.context.set(`vars.${name}`, value);
    
    return { name, value };
  }

  async handleTransform(action) {
    const input = this.context.interpolate(action.input);
    let output;
    
    switch (action.operation) {
      case 'json_parse':
        output = JSON.parse(input);
        break;
      case 'json_stringify':
        output = JSON.stringify(input, null, 2);
        break;
      case 'regex_extract':
        const regex = new RegExp(action.pattern, action.flags || 'g');
        const matches = input.match(regex);
        output = matches ? matches[0] : null;
        break;
      case 'split':
        output = input.split(action.delimiter || '\n');
        break;
      case 'join':
        output = input.join(action.delimiter || '\n');
        break;
      case 'lowercase':
        output = input.toLowerCase();
        break;
      case 'uppercase':
        output = input.toUpperCase();
        break;
      default:
        throw new Error(`Unknown transform operation: ${action.operation}`);
    }
    
    return output;
  }

  async handleTemplate(action) {
    let template;
    
    if (action.template_file) {
      const templatePath = this.context.interpolate(action.template_file);
      template = await fs.readFile(templatePath, 'utf8');
    } else if (action.template) {
      template = action.template;
    } else {
      throw new Error('No template or template_file specified');
    }
    
    // Simple template rendering - replace ${var} with context values
    const rendered = template.replace(/\${([^}]+)}/g, (match, path) => {
      return this.context.interpolate(`\${${path}}`);
    });
    
    return rendered;
  }

  interpolateObject(obj) {
    if (typeof obj === 'string') {
      return this.context.interpolate(obj);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.interpolateObject(item));
    } else if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.interpolateObject(value);
      }
      return result;
    }
    return obj;
  }
}

module.exports = ActionExecutor;