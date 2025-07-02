/**
 * Action Library Index - Modular action system for workflows
 */

const CoreActions = require('./core.cjs');
const ScriptActions = require('./script.cjs');
const FilesystemActions = require('./filesystem.cjs');
const ControlActions = require('./control.cjs');
const NetworkActions = require('./network.cjs');
const DataActions = require('./data.cjs');

class ActionLibrary {
  constructor(context, options = {}) {
    this.context = context;
    this.options = options;
    
    // Initialize action modules
    this.modules = {
      core: new CoreActions(context, options),
      script: new ScriptActions(context, options),
      filesystem: new FilesystemActions(context, options),
      control: new ControlActions(context, { ...options, actionExecutor: this }),
      network: new NetworkActions(context, options),
      data: new DataActions(context, options)
    };
    
    // Build action handler map
    this.handlers = {};
    this.registerActions();
  }

  registerActions() {
    // Core actions
    this.handlers['send_prompt'] = this.modules.core.send_prompt.bind(this.modules.core);
    this.handlers['spawn'] = this.modules.core.spawn.bind(this.modules.core);
    this.handlers['terminate'] = this.modules.core.terminate.bind(this.modules.core);
    this.handlers['log'] = this.modules.core.log.bind(this.modules.core);
    this.handlers['wait'] = this.modules.core.wait.bind(this.modules.core);
    this.handlers['set_var'] = this.modules.core.set_var.bind(this.modules.core);
    this.handlers['complete_workflow'] = this.modules.core.complete_workflow.bind(this.modules.core);
    
    // Script actions
    this.handlers['run_script'] = this.modules.script.run_script.bind(this.modules.script);
    
    // Filesystem actions
    this.handlers['save_file'] = this.modules.filesystem.save_file.bind(this.modules.filesystem);
    this.handlers['read_file'] = this.modules.filesystem.read_file.bind(this.modules.filesystem);
    this.handlers['delete_file'] = this.modules.filesystem.delete_file.bind(this.modules.filesystem);
    this.handlers['create_directory'] = this.modules.filesystem.create_directory.bind(this.modules.filesystem);
    this.handlers['copy_file'] = this.modules.filesystem.copy_file.bind(this.modules.filesystem);
    this.handlers['list_files'] = this.modules.filesystem.list_files.bind(this.modules.filesystem);
    this.handlers['file_exists'] = this.modules.filesystem.file_exists.bind(this.modules.filesystem);
    this.handlers['append_file'] = this.modules.filesystem.append_file.bind(this.modules.filesystem);
    
    // Control flow actions
    this.handlers['conditional'] = this.modules.control.conditional.bind(this.modules.control);
    this.handlers['parallel'] = this.modules.control.parallel.bind(this.modules.control);
    this.handlers['foreach'] = this.modules.control.foreach.bind(this.modules.control);
    this.handlers['while_loop'] = this.modules.control.while_loop.bind(this.modules.control);
    this.handlers['try_catch'] = this.modules.control.try_catch.bind(this.modules.control);
    
    // Network actions
    this.handlers['http_request'] = this.modules.network.http_request.bind(this.modules.network);
    this.handlers['webhook'] = this.modules.network.webhook.bind(this.modules.network);
    this.handlers['slack_notify'] = this.modules.network.slack_notify.bind(this.modules.network);
    this.handlers['discord_notify'] = this.modules.network.discord_notify.bind(this.modules.network);
    this.handlers['download_file'] = this.modules.network.download_file.bind(this.modules.network);
    this.handlers['upload_file'] = this.modules.network.upload_file.bind(this.modules.network);
    
    // Data actions
    this.handlers['transform'] = this.modules.data.transform.bind(this.modules.data);
    this.handlers['aggregate'] = this.modules.data.aggregate.bind(this.modules.data);
    this.handlers['template'] = this.modules.data.template.bind(this.modules.data);
    this.handlers['validate'] = this.modules.data.validate.bind(this.modules.data);
    this.handlers['generate_data'] = this.modules.data.generate_data.bind(this.modules.data);
  }

  async execute(action) {
    const actionType = action.action;
    const handler = this.handlers[actionType];
    
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }
    
    try {
      const result = await handler(action);
      
      // Store result in context if output_var is specified
      if (action.output_var && result !== undefined) {
        this.context.set(`actions.${action.output_var}`, result);
      }
      
      return result;
    } catch (error) {
      // Add action context to error
      error.action = actionType;
      error.actionData = action;
      throw error;
    }
  }

  // Get available action types
  getAvailableActions() {
    return Object.keys(this.handlers);
  }

  // Get action documentation
  getActionDocs(actionType) {
    const docs = {
      // Core actions
      'send_prompt': 'Send a prompt to a Claude instance',
      'spawn': 'Create a new Claude instance',
      'terminate': 'Terminate a Claude instance',
      'log': 'Log a message',
      'wait': 'Wait for specified seconds',
      'set_var': 'Set a variable in context',
      'complete_workflow': 'Complete the workflow',
      
      // Script actions
      'run_script': 'Execute a script locally or in instance',
      
      // Filesystem actions
      'save_file': 'Save content to a file',
      'read_file': 'Read content from a file',
      'delete_file': 'Delete a file',
      'create_directory': 'Create a directory',
      'copy_file': 'Copy a file',
      'list_files': 'List files in a directory',
      'file_exists': 'Check if file exists',
      'append_file': 'Append content to a file',
      
      // Control flow actions
      'conditional': 'Execute actions based on condition',
      'parallel': 'Execute actions in parallel',
      'foreach': 'Execute actions for each item',
      'while_loop': 'Execute actions while condition is true',
      'try_catch': 'Try actions with error handling',
      
      // Network actions
      'http_request': 'Make HTTP request',
      'webhook': 'Send webhook notification',
      'slack_notify': 'Send Slack notification',
      'discord_notify': 'Send Discord notification',
      'download_file': 'Download file from URL',
      'upload_file': 'Upload file to URL',
      
      // Data actions
      'transform': 'Transform data using various operations',
      'aggregate': 'Aggregate multiple data sources',
      'template': 'Render template with context data',
      'validate': 'Validate data against rules',
      'generate_data': 'Generate synthetic test data'
    };
    
    return docs[actionType] || 'No documentation available';
  }
}

module.exports = ActionLibrary;