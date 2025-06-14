/**
 * Script execution actions - Run any executable files
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

class ScriptActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
    this.bridge = options.bridge;
  }

  /**
   * Execute a script locally or in Claude instance
   */
  async run_script(action) {
    const script = this.context.interpolate(action.script);
    const args = (action.args || []).map(arg => this.context.interpolate(arg));
    const env = action.env ? this.interpolateObject(action.env) : process.env;
    const workingDir = action.working_dir || process.cwd();
    const timeout = (action.timeout || 300) * 1000;
    
    console.log(`Running script: ${script} ${args.join(' ')}`);
    
    // Determine where to run the script
    if (action.target === 'instance') {
      return await this.runInInstance(script, args, action);
    } else {
      return await this.runLocally(script, args, env, workingDir, timeout, action);
    }
  }

  async runInInstance(script, args, action) {
    // Run inside Claude instance
    const instanceId = action.instance_id || action._instance_id || this.context.get('instance.id');
    
    // Construct command to run in instance
    const command = [script, ...args].join(' ');
    const workingDir = action.working_dir || process.cwd();
    
    const wrappedPrompt = `
Run this command and report the results:
\`\`\`bash
cd ${workingDir}
${command}
\`\`\`

Report the exit code and any output.
When done, say ***SCRIPT_COMPLETE***`;
    
    const CoreActions = require('./core');
    const core = new CoreActions(this.context, { bridge: this.bridge });
    
    const result = await core.send_prompt({
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
  }

  async runLocally(script, args, env, workingDir, timeout, action) {
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
      
      // Handle stdin if provided
      if (action.stdin) {
        const stdinData = this.context.interpolate(action.stdin);
        child.stdin.write(stdinData);
        child.stdin.end();
      }
      
      // Capture output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
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

module.exports = ScriptActions;