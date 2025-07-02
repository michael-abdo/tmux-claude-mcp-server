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
}

module.exports = ActionExecutor;