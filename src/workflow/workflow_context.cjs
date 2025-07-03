/**
 * Workflow Context - Manages workflow state and variable interpolation
 */

const fs = require('fs').promises;
const path = require('path');

class WorkflowContext {
  constructor(initialData = {}) {
    this.data = {
      workflow: {
        start_time: Date.now(),
        ...initialData.workflow
      },
      settings: initialData.settings || {},
      stage: {},
      instance: {},
      actions: {},
      stages: {},
      vars: {},
      env: process.env
    };
  }

  // Get a value from the context using dot notation
  get(path) {
    const parts = path.split('.');
    let current = this.data;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  // Set a value in the context using dot notation
  set(path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let current = this.data;
    
    for (const part of parts) {
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[lastPart] = value;
  }

  // Check if a path exists
  has(path) {
    return this.get(path) !== undefined;
  }

  // Set current stage information
  setStage(stageId, stageData) {
    this.data.stage = {
      id: stageId,
      ...stageData
    };
    
    // Initialize stage history
    if (!this.data.stages[stageId]) {
      this.data.stages[stageId] = {
        id: stageId,
        ...stageData
      };
    }
  }

  // Update stage information
  updateStage(stageId, updates) {
    if (this.data.stages[stageId]) {
      Object.assign(this.data.stages[stageId], updates);
    }
    
    // Update current stage if it matches
    if (this.data.stage.id === stageId) {
      Object.assign(this.data.stage, updates);
    }
  }

  // Interpolate a string with context variables
  interpolate(template) {
    if (typeof template !== 'string') {
      return template;
    }
    
    // Handle ${variable} syntax
    return template.replace(/\${([^}]+)}/g, (match, expression) => {
      try {
        // Check if it's a simple path
        if (/^[\w.]+$/.test(expression)) {
          const value = this.get(expression);
          if (value === undefined) {
            return match; // Keep original if not found
          }
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        
        // Evaluate more complex expressions
        // Create a safe evaluation context
        const context = this.createEvalContext();
        const result = new Function(...Object.keys(context), `return ${expression}`)(...Object.values(context));
        
        return typeof result === 'object' ? JSON.stringify(result) : String(result);
      } catch (error) {
        console.warn(`Failed to interpolate expression: ${expression}`, error);
        return match;
      }
    });
  }

  // Create a safe context for expression evaluation
  createEvalContext() {
    return {
      // Direct access to context data
      workflow: this.data.workflow,
      settings: this.data.settings,
      stage: this.data.stage,
      instance: this.data.instance,
      actions: this.data.actions,
      stages: this.data.stages,
      vars: this.data.vars,
      env: this.data.env,
      
      // Utility functions
      JSON: JSON,
      Math: Math,
      Date: Date,
      parseInt: parseInt,
      parseFloat: parseFloat,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Array: Array,
      Object: Object,
      
      // Helper functions
      timestamp: () => new Date().toISOString(),
      now: () => Date.now(),
      random: () => Math.random()
    };
  }

  // Get a summary of the current context state
  getSummary() {
    return {
      workflow: {
        id: this.data.workflow.id,
        name: this.data.workflow.name,
        run_id: this.data.workflow.run_id,
        duration: Date.now() - this.data.workflow.start_time
      },
      current_stage: this.data.stage.id,
      completed_stages: Object.keys(this.data.stages).filter(
        id => this.data.stages[id].status === 'completed'
      ),
      variables: Object.keys(this.data.vars),
      actions_count: Object.keys(this.data.actions).length
    };
  }

  // Save context to file
  async save(filePath) {
    const savePath = filePath || path.join(
      'workflow_state',
      `${this.data.workflow.run_id}.json`
    );
    
    await fs.mkdir(path.dirname(savePath), { recursive: true });
    await fs.writeFile(savePath, JSON.stringify(this.data, null, 2));
    
    console.log(`Saved workflow context to: ${savePath}`);
    return savePath;
  }

  // Load context from file
  static async load(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    return new WorkflowContext(data);
  }

  // Clone the context
  clone() {
    return new WorkflowContext(JSON.parse(JSON.stringify(this.data)));
  }
}

module.exports = WorkflowContext;