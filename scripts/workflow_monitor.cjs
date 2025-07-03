#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class WorkflowMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.monitors = new Map(); // instanceId -> { monitor, triggers }
    this.activeWorkflows = new Map(); // instanceId -> Set of running workflows
    this.pollInterval = options.pollInterval || 2000;
    this.restartDelay = options.restartDelay || 5000;
    this.configPath = options.configPath || path.join(__dirname, '..', 'config', 'workflow_monitors.json');
    this.logFile = options.logFile || path.join(__dirname, '..', 'logs', 'workflow_monitor.log');
  }

  /**
   * Watch an instance for keyword triggers
   * @param {string} instanceId - The instance to monitor
   * @param {Object} triggers - Map of keyword -> workflow path
   * @param {Object} options - Additional options
   */
  async watchInstance(instanceId, triggers, options = {}) {
    console.log(`\n🔍 Starting persistent monitor for instance: ${instanceId}`);
    console.log(`📋 Watching for keywords:`, Object.keys(triggers));

    // Stop existing monitor if any
    if (this.monitors.has(instanceId)) {
      await this.stopWatching(instanceId);
    }

    // Create monitor configuration
    const monitorConfig = {
      instanceId,
      triggers,
      options: {
        continuous: true,
        pollInterval: options.pollInterval || this.pollInterval,
        restartDelay: options.restartDelay || this.restartDelay,
        ...options
      },
      outputBuffer: '',
      lastPosition: 0,
      active: true
    };

    // Start the monitoring loop
    this.monitors.set(instanceId, monitorConfig);
    this.activeWorkflows.set(instanceId, new Set());
    
    // Start monitoring
    this.startMonitoringLoop(instanceId);
    
    // Save configuration
    await this.saveConfiguration();
    
    console.log(`✅ Monitor started for ${instanceId}`);
  }

  /**
   * Main monitoring loop for an instance
   */
  async startMonitoringLoop(instanceId) {
    const config = this.monitors.get(instanceId);
    if (!config || !config.active) return;

    try {
      // Read instance output
      const output = await this.readInstanceOutput(instanceId, config.lastPosition);
      
      if (output && output.trim()) {
        // Add to buffer
        config.outputBuffer += output;
        
        // Check for keywords
        for (const [keyword, workflowPath] of Object.entries(config.triggers)) {
          if (this.detectKeyword(keyword, output)) {
            console.log(`\n🎯 Keyword detected: "${keyword}" in instance ${instanceId}`);
            
            // Log the detection
            this.logDetection(instanceId, keyword, workflowPath);
            
            // Launch workflow (non-blocking)
            this.launchWorkflow(workflowPath, instanceId, keyword)
              .catch(err => console.error(`❌ Failed to launch workflow:`, err));
            
            // Optional: Clear buffer after detection to avoid re-detection
            if (config.options.clearBufferOnDetection) {
              config.outputBuffer = '';
            }
          }
        }
        
        // Update position
        config.lastPosition += output.length;
      }
    } catch (error) {
      console.error(`❌ Error monitoring ${instanceId}:`, error.message);
    }

    // Schedule next check
    if (config.active) {
      setTimeout(() => {
        this.startMonitoringLoop(instanceId);
      }, config.options.pollInterval);
    }
  }

  /**
   * Read output from an instance using MCP bridge
   */
  async readInstanceOutput(instanceId, fromPosition = 0) {
    try {
      const result = await execAsync(
        `node ${path.join(__dirname, 'mcp_bridge.js')} read '{"instanceId": "${instanceId}", "lines": 50}'`
      );
      
      // Extract JSON from output (MCP bridge may output status messages)
      const lines = result.stdout.split('\n');
      let jsonLine = '';
      
      // Find the JSON line (starts with '{')
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          jsonLine = line;
          break;
        }
      }
      
      if (!jsonLine) {
        throw new Error('No JSON response found');
      }
      
      const response = JSON.parse(jsonLine);
      if (response.error) {
        throw new Error(response.error);
      }
      
      // Extract new content since last position
      const fullOutput = response.output || '';
      return fullOutput.substring(fromPosition);
      
    } catch (error) {
      throw new Error(`Failed to read instance output: ${error.message}`);
    }
  }

  /**
   * Detect keyword in output
   */
  detectKeyword(keyword, output) {
    // Simple detection - can be enhanced with regex patterns
    return output.includes(keyword);
  }

  /**
   * Launch a workflow for an instance
   */
  async launchWorkflow(workflowPath, instanceId, keyword) {
    console.log(`\n🚀 Launching workflow: ${workflowPath}`);
    console.log(`   Triggered by: "${keyword}" from ${instanceId}`);

    // Check if workflow is already running
    const activeSet = this.activeWorkflows.get(instanceId);
    if (activeSet && activeSet.has(workflowPath)) {
      console.log(`⚠️  Workflow already running, skipping duplicate launch`);
      return;
    }

    // Mark workflow as active
    if (activeSet) {
      activeSet.add(workflowPath);
    }

    try {
      // Launch workflow with instance binding
      const cmd = `node ${path.join(__dirname, '..', 'src', 'workflow', 'workflow_engine.cjs')} ` +
                  `"${workflowPath}" --bind-instance ${instanceId}`;
      
      console.log(`📌 Executing: ${cmd}`);
      
      // Execute workflow (non-blocking)
      exec(cmd, (error, stdout, stderr) => {
        // Remove from active set when done
        if (activeSet) {
          activeSet.delete(workflowPath);
        }

        if (error) {
          console.error(`❌ Workflow execution failed:`, error);
          console.error(`stderr:`, stderr);
        } else {
          console.log(`✅ Workflow completed successfully`);
          if (stdout) console.log(`stdout:`, stdout);
        }
      });

      // Give workflow time to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      // Remove from active set on error
      if (activeSet) {
        activeSet.delete(workflowPath);
      }
      throw error;
    }
  }

  /**
   * Stop watching an instance
   */
  async stopWatching(instanceId) {
    console.log(`\n🛑 Stopping monitor for instance: ${instanceId}`);
    
    const config = this.monitors.get(instanceId);
    if (config) {
      config.active = false;
      this.monitors.delete(instanceId);
      this.activeWorkflows.delete(instanceId);
    }
    
    await this.saveConfiguration();
    console.log(`✅ Monitor stopped for ${instanceId}`);
  }

  /**
   * List all active monitors
   */
  listMonitors() {
    console.log(`\n📊 Active Monitors:`);
    console.log(`${'='.repeat(60)}`);
    
    if (this.monitors.size === 0) {
      console.log(`No active monitors`);
      return;
    }

    for (const [instanceId, config] of this.monitors.entries()) {
      console.log(`\nInstance: ${instanceId}`);
      console.log(`Status: ${config.active ? '🟢 Active' : '🔴 Inactive'}`);
      console.log(`Triggers:`);
      for (const [keyword, workflow] of Object.entries(config.triggers)) {
        console.log(`  - "${keyword}" → ${path.basename(workflow)}`);
      }
      
      const activeWorkflows = this.activeWorkflows.get(instanceId);
      if (activeWorkflows && activeWorkflows.size > 0) {
        console.log(`Running workflows: ${activeWorkflows.size}`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
  }

  /**
   * Save monitor configuration to disk
   */
  async saveConfiguration() {
    const config = {
      monitors: Array.from(this.monitors.entries()).map(([id, cfg]) => ({
        instanceId: id,
        triggers: cfg.triggers,
        options: cfg.options,
        active: cfg.active
      })),
      savedAt: new Date().toISOString()
    };

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Load configuration from disk
   */
  async loadConfiguration() {
    if (!fs.existsSync(this.configPath)) {
      return;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      
      for (const monitor of data.monitors) {
        if (monitor.active) {
          await this.watchInstance(
            monitor.instanceId,
            monitor.triggers,
            monitor.options
          );
        }
      }
      
      console.log(`✅ Loaded ${data.monitors.length} monitor configurations`);
    } catch (error) {
      console.error(`❌ Failed to load configuration:`, error);
    }
  }

  /**
   * Log keyword detection
   */
  logDetection(instanceId, keyword, workflowPath) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      instanceId,
      keyword,
      workflow: path.basename(workflowPath),
      workflowPath
    };

    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Append to log file
    fs.appendFileSync(
      this.logFile,
      JSON.stringify(logEntry) + '\n'
    );
  }
}

// CLI Interface
async function main() {
  const monitor = new WorkflowMonitor();
  const args = process.argv.slice(2);
  const command = args[0];

  console.log(`\n🔧 Workflow Monitor Service`);
  console.log(`${'='.repeat(40)}`);

  switch (command) {
    case 'watch':
      if (args.length < 3) {
        console.error('Usage: workflow_monitor.js watch <instanceId> <keyword:workflow> [keyword2:workflow2 ...]');
        console.error('Example: workflow_monitor.js watch spec_1_1_123 "DONE:./workflows/done.yaml" "ERROR:./workflows/error.yaml"');
        process.exit(1);
      }

      const instanceId = args[1];
      const triggers = {};
      
      // Parse keyword:workflow pairs
      for (let i = 2; i < args.length; i++) {
        const [keyword, workflow] = args[i].split(':');
        if (!keyword || !workflow) {
          console.error(`Invalid trigger format: ${args[i]}`);
          console.error('Expected format: keyword:workflow_path');
          process.exit(1);
        }
        triggers[keyword] = workflow;
      }

      await monitor.watchInstance(instanceId, triggers);
      console.log('\n⏳ Monitor running... Press Ctrl+C to stop');
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down monitor...');
        await monitor.stopWatching(instanceId);
        process.exit(0);
      });
      break;

    case 'stop':
      if (args.length < 2) {
        console.error('Usage: workflow_monitor.js stop <instanceId>');
        process.exit(1);
      }
      
      await monitor.loadConfiguration();
      await monitor.stopWatching(args[1]);
      break;

    case 'list':
      await monitor.loadConfiguration();
      monitor.listMonitors();
      break;

    case 'daemon':
      // Run as persistent daemon
      console.log('🌟 Starting Workflow Monitor Daemon...');
      await monitor.loadConfiguration();
      monitor.listMonitors();
      
      console.log('\n⏳ Daemon running... Press Ctrl+C to stop');
      
      // Keep process alive
      process.on('SIGINT', async () => {
        console.log('\n\n🛑 Shutting down daemon...');
        await monitor.saveConfiguration();
        process.exit(0);
      });
      break;

    default:
      console.log(`
Usage: workflow_monitor.js <command> [options]

Commands:
  watch <instanceId> <keyword:workflow> ...  Start watching an instance
  stop <instanceId>                          Stop watching an instance
  list                                       List all active monitors
  daemon                                     Run as persistent daemon

Examples:
  # Watch for single keyword
  node workflow_monitor.js watch spec_1_1_123 "DONE:./workflows/done.yaml"
  
  # Watch for multiple keywords
  node workflow_monitor.js watch spec_1_1_123 "DONE:./workflows/done.yaml" "ERROR:./workflows/error.yaml"
  
  # Run as daemon (loads saved configuration)
  node workflow_monitor.js daemon
`);
      break;
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = WorkflowMonitor;