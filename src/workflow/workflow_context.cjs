/**
 * Workflow Context - Manages workflow state and variable interpolation
 * Supports task ID mode and simple mode with smart pattern handling
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class WorkflowContext {
  constructor(initialData = {}) {
    this.data = {
      workflow: {
        id: uuidv4(),
        start_time: Date.now(),
        ...initialData.workflow
      },
      settings: {
        useTaskIds: false,
        poll_interval: 5,
        timeout: 300,
        instance_role: 'specialist',
        workspace_mode: 'isolated',
        ...initialData.settings
      },
      stages: {},
      instances: {},
      vars: {},
      actions: {},
      ...initialData
    };
    
    // Generate current task ID if using task IDs
    if (this.data.settings.useTaskIds) {
      this.data.vars.current_task_id = this.generateTaskId();
    }
  }
  
  // Get value by dot notation path
  get(path) {
    return this.getNestedValue(this.data, path);
  }
  
  // Set value by dot notation path
  set(path, value) {
    this.setNestedValue(this.data, path, value);
  }
  
  // Update stage information
  setStage(stageId, stageData) {
    this.data.stages[stageId] = {
      ...this.data.stages[stageId],
      ...stageData
    };
  }
  
  // Update existing stage
  updateStage(stageId, updates) {
    if (this.data.stages[stageId]) {
      Object.assign(this.data.stages[stageId], updates);
    }
  }
  
  // Interpolate template string with context variables
  interpolate(template) {
    if (typeof template !== 'string') {
      return template;
    }
    
    let result = template;
    
    // ARCHITECTURAL FX: Handle task ID patterns intelligently when task IDs are disabled
    if (!this.get('settings.useTaskIds')) {
      // Smart pattern removal for common task ID patterns
      result = result
        .replace(/\$\{current_task_id\}_([A-Z_]+)/g, '$1')
        .replace(/([A-Z_]+)_\$\{current_task_id\}_([A-Z_]+)/g, '$1_$2')
        .replace(/\$\{current_task_id\}/g, '');
    }
    
    // Standard variable interpolation
    result = result.replace(/\$\{([^}]+)\}/g, (match, path) => {
      const value = this.get(path);
      return value !== undefined ? value : match;
    });
    
    return result;
  }
  
  // Generate a unique task ID
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
  
  // Get nested value using dot notation
  getNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }
  
  // Set nested value using dot notation
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  // Get current stage information
  getCurrentStage() {
    const stages = this.data.stages;
    const stageIds = Object.keys(stages);
    
    // Find the most recently started stage
    let currentStage = null;
    let latestStartTime = 0;
    
    for (const stageId of stageIds) {
      const stage = stages[stageId];
      if (stage.status === 'running' && stage.start_time > latestStartTime) {
        latestStartTime = stage.start_time;
        currentStage = { id: stageId, ...stage };
      }
    }
    
    return currentStage;
  }
  
  // Get all active instances
  getActiveInstances() {
    return { ...this.data.instances };
  }
  
  // Add instance to tracking
  addInstance(instanceId, instanceData) {
    this.data.instances[instanceId] = {
      created_at: Date.now(),
      status: 'active',
      ...instanceData
    };
  }
  
  // Remove instance from tracking
  removeInstance(instanceId) {
    delete this.data.instances[instanceId];
  }
  
  // Get workflow summary
  getSummary() {
    return {
      workflow: this.data.workflow,
      settings: this.data.settings,
      stages: Object.keys(this.data.stages).length,
      instances: Object.keys(this.data.instances).length,
      variables: Object.keys(this.data.vars).length
    };
  }
  
  // Export context for debugging
  export() {
    return JSON.parse(JSON.stringify(this.data));
  }
  
  // Save context to file
  async save(filePath) {
    if (!filePath) {
      filePath = path.join(process.cwd(), 'workflow_context.json');
    }
    
    const contextData = {
      ...this.data,
      saved_at: Date.now()
    };
    
    await fs.writeFile(filePath, JSON.stringify(contextData, null, 2));
    console.log(`💾 Context saved to: ${filePath}`);
  }
  
  // Load context from file
  static async load(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Remove saved_at timestamp
      delete data.saved_at;
      
      return new WorkflowContext(data);
    } catch (error) {
      throw new Error(`Failed to load context from ${filePath}: ${error.message}`);
    }
  }
  
  // Create context from workflow config
  static fromConfig(config, options = {}) {
    return new WorkflowContext({
      workflow: {
        id: config.id || uuidv4(),
        name: config.name,
        version: config.version,
        description: config.description
      },
      settings: {
        ...config.settings,
        ...options
      }
    });
  }
  
  // Enable/disable task ID mode
  setTaskIdMode(enabled) {
    this.data.settings.useTaskIds = enabled;
    
    if (enabled && !this.data.vars.current_task_id) {
      this.data.vars.current_task_id = this.generateTaskId();
    }
    
    console.log(`Task ID mode: ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  // Get debug information
  getDebugInfo() {
    return {
      context_size: JSON.stringify(this.data).length,
      variables: Object.keys(this.data.vars),
      instances: Object.keys(this.data.instances),
      stages: Object.keys(this.data.stages),
      task_id_mode: this.data.settings.useTaskIds,
      current_task_id: this.data.vars.current_task_id
    };
  }
}

module.exports = WorkflowContext;