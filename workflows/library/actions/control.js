/**
 * Control flow actions - Conditionals, loops, and flow control
 */

const EventEmitter = require('events');

class ControlActions extends EventEmitter {
  constructor(context, options = {}) {
    super();
    this.context = context;
    this.actionExecutor = options.actionExecutor; // Reference to main executor for nested actions
  }

  /**
   * Conditional execution based on expression
   */
  async conditional(action) {
    const condition = this.context.interpolate(action.condition);
    const result = this.evaluateCondition(condition);
    
    console.log(`Conditional: ${condition} = ${result}`);
    
    const actionsToExecute = result ? action.if_true : action.if_false;
    
    if (actionsToExecute && this.actionExecutor) {
      // Execute nested actions
      for (const subAction of actionsToExecute) {
        await this.actionExecutor.execute(subAction);
      }
    }
    
    return { condition, result, executed: actionsToExecute ? actionsToExecute.length : 0 };
  }

  /**
   * Execute actions in parallel
   */
  async parallel(action) {
    const maxConcurrent = action.max_concurrent || action.actions.length;
    const waitAll = action.wait_all !== false;
    const continueOnFailure = action.continue_on_failure || false;
    
    console.log(`Executing ${action.actions.length} actions in parallel (max ${maxConcurrent})`);
    
    if (!this.actionExecutor) {
      throw new Error('Action executor not available for parallel execution');
    }
    
    const promises = action.actions.map(subAction => 
      this.actionExecutor.execute(subAction)
        .catch(error => {
          if (continueOnFailure) {
            console.error('Parallel action failed (continuing):', error);
            return { error: error.message, failed: true };
          }
          throw error;
        })
    );
    
    if (waitAll) {
      const results = await Promise.all(promises);
      const failed = results.filter(r => r && r.failed).length;
      return { 
        completed: results.length, 
        failed,
        success: failed === 0
      };
    } else {
      // Fire and forget
      promises.forEach(p => p.catch(console.error));
      return { started: promises.length, waiting: false };
    }
  }

  /**
   * Execute actions for each item in an array
   */
  async foreach(action) {
    const items = this.context.interpolate(action.items);
    const itemsArray = this.evaluateExpression(items);
    
    console.log(`Executing foreach over ${itemsArray.length} items`);
    
    if (!this.actionExecutor) {
      throw new Error('Action executor not available for foreach execution');
    }
    
    const results = [];
    
    for (const [index, item] of itemsArray.entries()) {
      // Set item in context
      this.context.set(`vars.${action.item_var}`, item);
      this.context.set('vars._index', index);
      this.context.set('vars._count', itemsArray.length);
      
      try {
        for (const subAction of action.actions) {
          const result = await this.actionExecutor.execute(subAction);
          results.push(result);
        }
      } catch (error) {
        if (action.continue_on_error) {
          console.error(`Foreach item ${index} failed (continuing):`, error);
          results.push({ error: error.message, failed: true, index });
        } else {
          throw error;
        }
      }
    }
    
    return { 
      processed: itemsArray.length, 
      results: results.length,
      failed: results.filter(r => r && r.failed).length
    };
  }

  /**
   * While loop execution
   */
  async while_loop(action) {
    const maxIterations = action.max_iterations || 100; // Safety limit
    let iterations = 0;
    const results = [];
    
    console.log(`Starting while loop (max ${maxIterations} iterations)`);
    
    if (!this.actionExecutor) {
      throw new Error('Action executor not available for while loop execution');
    }
    
    while (iterations < maxIterations) {
      const condition = this.context.interpolate(action.condition);
      const shouldContinue = this.evaluateCondition(condition);
      
      if (!shouldContinue) {
        break;
      }
      
      this.context.set('vars._iteration', iterations);
      
      try {
        for (const subAction of action.actions) {
          const result = await this.actionExecutor.execute(subAction);
          results.push(result);
        }
      } catch (error) {
        if (action.break_on_error) {
          console.error(`While loop broke on iteration ${iterations}:`, error);
          break;
        } else {
          throw error;
        }
      }
      
      iterations++;
    }
    
    return { 
      iterations, 
      completed: iterations < maxIterations,
      results: results.length
    };
  }

  /**
   * Try-catch error handling
   */
  async try_catch(action) {
    if (!this.actionExecutor) {
      throw new Error('Action executor not available for try-catch execution');
    }
    
    try {
      const results = [];
      for (const subAction of action.try_actions) {
        const result = await this.actionExecutor.execute(subAction);
        results.push(result);
      }
      return { success: true, results: results.length };
    } catch (error) {
      console.log(`Try block failed, executing catch actions: ${error.message}`);
      
      // Store error in context
      this.context.set('vars._error', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      
      if (action.catch_actions) {
        const catchResults = [];
        for (const subAction of action.catch_actions) {
          const result = await this.actionExecutor.execute(subAction);
          catchResults.push(result);
        }
        return { 
          success: false, 
          error: error.message,
          catch_executed: catchResults.length
        };
      } else {
        // Re-throw if no catch actions
        throw error;
      }
    }
  }

  evaluateCondition(condition) {
    try {
      // Simple evaluation - in production, use a proper expression evaluator
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
}

module.exports = ControlActions;