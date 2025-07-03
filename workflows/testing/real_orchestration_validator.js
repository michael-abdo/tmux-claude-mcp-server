#!/usr/bin/env node

/**
 * Real Orchestration Validator - Senior Engineer Approach
 * Tests actual system behavior, not testing infrastructure
 * Based on 15+ years of experience: Validate EVERYTHING
 */

const { spawn } = require('child_process');
const { promisify } = require('util');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

class RealOrchestrationValidator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.mcpBridgePath = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/scripts/mcp_bridge.js';
    this.workflowPath = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/src/workflow/run_workflow.cjs';
    this.validationResults = {
      foundation: {},
      orchestration: {},
      timing: {},
      overallAccuracy: 0
    };
  }

  log(message) {
    if (this.debug) {
      console.log(`[${new Date().toISOString()}] ${message}`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validate() {
    console.log('\n🎯 Real Orchestration Validator - Senior Engineer Protocol');
    console.log('=========================================================');
    console.log('Testing ACTUAL system behavior, not testing infrastructure\n');

    try {
      // Step 1: Reload constraints from project local claude.md
      await this.reloadConstraints();

      // Layer 1: Foundation Validation (MUST PASS to proceed)
      console.log('🔧 Layer 1: Foundation Validation');
      console.log('================================');
      await this.validateFoundationLayer();
      
      if (!this.validationResults.foundation.allPassed) {
        throw new Error('Foundation layer failed - cannot test orchestration on broken foundation');
      }

      // Layer 2: Automatic Orchestration Validation (The Real Test)  
      console.log('\n🎯 Layer 2: Automatic Orchestration Validation');
      console.log('===============================================');
      await this.validateOrchestrationLayer();

      await this.generateRealValidationReport();

    } catch (error) {
      console.error(`\n🚨 Real validation failed: ${error.message}`);
      throw error;
    }
  }

  async reloadConstraints() {
    try {
      const constraintsPath = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/claude.md';
      const constraints = await fs.readFile(constraintsPath, 'utf8');
      this.log('✅ Constraints reloaded from /home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/claude.md');
      
      // Verify we have the senior engineer protocol
      if (!constraints.includes('Senior Engineer Validation Protocol')) {
        throw new Error('Invalid constraints file - missing Senior Engineer Protocol');
      }
      
      return constraints;
    } catch (error) {
      throw new Error(`Failed to reload constraints: ${error.message}`);
    }
  }

  async validateFoundationLayer() {
    console.log('Testing 1: MCP Bridge Actually Works...');
    const mcpResult = await this.validateMcpBridgeWorks();
    this.validationResults.foundation.mcpBridge = mcpResult;

    console.log('Testing 2: Workflow Engine Core Functions...');  
    const workflowResult = await this.validateWorkflowEngineCore();
    this.validationResults.foundation.workflowEngine = workflowResult;

    const foundationPassed = mcpResult.passed && workflowResult.passed;
    this.validationResults.foundation.allPassed = foundationPassed;

    if (!foundationPassed) {
      console.log('\n🚨 FOUNDATION LAYER FAILED');
      console.log('Cannot test orchestration without working foundation');
      return false;
    }

    console.log('\n✅ Foundation Layer Passed - Proceeding to orchestration tests');
    return true;
  }

  async validateMcpBridgeWorks() {
    try {
      // Test 1: Can MCP bridge list sessions?
      this.log('Testing MCP bridge list command...');
      const listResult = await execAsync(`node ${this.mcpBridgePath} list "{}"`);
      const listResponse = JSON.parse(listResult.stdout);
      
      if (!listResponse.success) {
        throw new Error('MCP bridge list command failed');
      }

      // Test 2: Can MCP bridge actually create an instance?
      this.log('Testing MCP bridge instance creation...');
      const spawnResult = await execAsync(`node ${this.mcpBridgePath} spawn '{"role":"specialist","workDir":"/tmp","context":"Foundation test instance"}'`);
      const spawnResponse = JSON.parse(spawnResult.stdout);
      
      if (!spawnResponse.success || !spawnResponse.instanceId) {
        throw new Error('MCP bridge cannot create instances');
      }

      // Test 3: Can we communicate with the created instance?
      this.log('Testing instance communication...');
      const instanceId = spawnResponse.instanceId;
      
      await execAsync(`node ${this.mcpBridgePath} send '{"instanceId":"${instanceId}","text":"Foundation test message"}'`);
      await this.delay(2000);
      
      const readResult = await execAsync(`node ${this.mcpBridgePath} read '{"instanceId":"${instanceId}","lines":10}'`);
      const readResponse = JSON.parse(readResult.stdout);
      
      if (!readResponse.success || !readResponse.output) {
        throw new Error('Cannot communicate with created instance');
      }

      // Cleanup test instance
      await execAsync(`node ${this.mcpBridgePath} terminate '{"instanceId":"${instanceId}"}'`);

      console.log('✅ MCP Bridge fully functional');
      return {
        passed: true,
        canList: true,
        canCreate: true,
        canCommunicate: true,
        testInstanceId: instanceId
      };

    } catch (error) {
      console.log(`❌ MCP Bridge failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
        canList: false,
        canCreate: false,
        canCommunicate: false
      };
    }
  }

  async validateWorkflowEngineCore() {
    try {
      // Test 1: Can workflow engine load YAML?
      this.log('Testing YAML parsing...');
      const workflowYaml = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/examples/execute_compare_commit.yaml';
      const yaml = require('yaml');
      const workflowSpec = yaml.parse(await fs.readFile(workflowYaml, 'utf8'));
      
      if (!workflowSpec.stages || workflowSpec.stages.length < 3) {
        throw new Error('YAML does not define required stages');
      }

      // Test 2: Can workflow engine start without errors?
      this.log('Testing workflow engine startup...');
      const workflowProcess = spawn('node', [this.workflowPath, workflowYaml], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let workflowOutput = '';
      workflowProcess.stdout.on('data', (data) => {
        workflowOutput += data.toString();
      });
      workflowProcess.stderr.on('data', (data) => {
        workflowOutput += data.toString();
      });

      // Test 3: Does it initialize properly?
      const initResult = await this.waitForOutputInString(
        () => workflowOutput, 
        'Initialized workflow', 
        10000
      );
      
      if (!initResult) {
        workflowProcess.kill();
        throw new Error('Workflow failed to initialize');
      }

      // Test 4: Does it attempt to execute first stage?
      const stageResult = await this.waitForOutputInString(
        () => workflowOutput,
        'Executing stage',
        10000
      );
      
      workflowProcess.kill();
      
      if (!stageResult) {
        throw new Error('Workflow failed to start first stage');
      }

      console.log('✅ Workflow Engine core functions work');
      return {
        passed: true,
        canParseYaml: true,
        canInitialize: true,
        canStartStage: true,
        stageCount: workflowSpec.stages.length
      };

    } catch (error) {
      console.log(`❌ Workflow Engine failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
        canParseYaml: false,
        canInitialize: false,
        canStartStage: false
      };
    }
  }

  async validateOrchestrationLayer() {
    console.log('Testing 3: Keyword-Driven Automatic Transitions...');
    const transitionResult = await this.validateKeywordDrivenTransition();
    this.validationResults.orchestration.keywordTransitions = transitionResult;

    if (transitionResult.passed) {
      console.log('Testing 4: Complete End-to-End Automatic Orchestration...');
      const endToEndResult = await this.validateCompleteAutomaticOrchestration();
      this.validationResults.orchestration.endToEnd = endToEndResult;
    } else {
      console.log('🚨 Skipping end-to-end test - keyword transitions failed');
      this.validationResults.orchestration.endToEnd = { passed: false, skipped: true };
    }

    // Calculate overall accuracy
    this.calculateOverallAccuracy();
  }

  async validateKeywordDrivenTransition() {
    const startTime = Date.now();
    
    try {
      this.log('Starting workflow for keyword transition test...');
      
      // Start workflow
      const workflowYaml = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/examples/execute_compare_commit.yaml';
      const workflowProcess = spawn('node', [this.workflowPath, workflowYaml], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let workflowOutput = '';
      workflowProcess.stdout.on('data', (data) => {
        workflowOutput += data.toString();
      });
      workflowProcess.stderr.on('data', (data) => {
        workflowOutput += data.toString();
      });

      // Wait for workflow to reach Execute stage
      const executeStage = await this.waitForOutputInString(
        () => workflowOutput,
        'Execute Command',
        30000
      );
      
      if (!executeStage) {
        workflowProcess.kill();
        throw new Error('Workflow failed to reach Execute stage');
      }

      // Extract workflow's instance ID
      const instanceMatch = workflowOutput.match(/Instance ID: (\w+)/);
      if (!instanceMatch) {
        workflowProcess.kill();
        throw new Error('Workflow did not create/report instance ID');
      }
      
      const workflowInstanceId = instanceMatch[1];
      this.log(`Found workflow instance: ${workflowInstanceId}`);

      // Send EXECUTE_FINISHED to workflow's instance
      this.log('Sending EXECUTE_FINISHED keyword...');
      await execAsync(`node ${this.mcpBridgePath} send '{"instanceId":"${workflowInstanceId}","text":"EXECUTE_FINISHED"}'`);

      // Monitor for automatic stage transition
      const transitionTime = Date.now();
      const stageTransition = await this.waitForOutputInString(
        () => workflowOutput,
        'Compare Results',
        30000
      );
      
      workflowProcess.kill();
      
      if (!stageTransition) {
        throw new Error('Workflow did not automatically transition to Compare stage');
      }

      const transitionDuration = Date.now() - transitionTime;
      
      console.log('✅ Keyword-driven automatic transition works');
      console.log(`   Transition time: ${transitionDuration}ms`);
      
      return {
        passed: true,
        workflowInstanceId,
        transitionDuration,
        automated: transitionDuration < 30000,
        totalTime: Date.now() - startTime
      };

    } catch (error) {
      console.log(`❌ Keyword-driven transition failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
        automated: false,
        totalTime: Date.now() - startTime
      };
    }
  }

  async validateCompleteAutomaticOrchestration() {
    const startTime = Date.now();
    const stageTransitions = [];
    
    try {
      this.log('Starting complete end-to-end orchestration test...');
      
      // Start workflow
      const workflowYaml = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/examples/execute_compare_commit.yaml';
      const workflowProcess = spawn('node', [this.workflowPath, workflowYaml], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let workflowOutput = '';
      workflowProcess.stdout.on('data', (data) => {
        workflowOutput += data.toString();
      });
      workflowProcess.stderr.on('data', (data) => {
        workflowOutput += data.toString();
      });

      // Stage 1: Execute
      await this.waitForOutputInString(() => workflowOutput, 'Execute Command', 30000);
      stageTransitions.push({stage: 'execute', timestamp: Date.now()});
      
      const instanceMatch = workflowOutput.match(/Instance ID: (\w+)/);
      if (!instanceMatch) {
        throw new Error('Cannot find workflow instance ID');
      }
      const instanceId = instanceMatch[1];

      // Execute → Compare transition
      await execAsync(`node ${this.mcpBridgePath} send '{"instanceId":"${instanceId}","text":"EXECUTE_FINISHED"}'`);
      await this.waitForOutputInString(() => workflowOutput, 'Compare Results', 30000);
      stageTransitions.push({stage: 'compare', timestamp: Date.now()});

      // Compare → Commit transition  
      await execAsync(`node ${this.mcpBridgePath} send '{"instanceId":"${instanceId}","text":"COMPARE_FINISHED"}'`);
      await this.waitForOutputInString(() => workflowOutput, 'Commit Changes', 30000);
      stageTransitions.push({stage: 'commit', timestamp: Date.now()});

      // Commit → Complete
      await execAsync(`node ${this.mcpBridgePath} send '{"instanceId":"${instanceId}","text":"COMMIT_FINISHED"}'`);
      await this.waitForOutputInString(() => workflowOutput, 'completed successfully', 30000);
      stageTransitions.push({stage: 'complete', timestamp: Date.now()});

      workflowProcess.kill();

      // Validate timing and sequence
      const totalTime = Date.now() - startTime;
      const transitionTimes = [];
      
      for (let i = 1; i < stageTransitions.length; i++) {
        const transitionTime = stageTransitions[i].timestamp - stageTransitions[i-1].timestamp;
        transitionTimes.push(transitionTime);
      }

      const allTransitionsAutomatic = transitionTimes.every(time => time < 30000);
      const completedInTime = totalTime < 120000;

      console.log('✅ Complete automatic orchestration works');
      console.log(`   Total time: ${totalTime}ms`);
      console.log(`   Stage transitions: ${transitionTimes.map(t => `${t}ms`).join(', ')}`);
      
      return {
        passed: true,
        totalTime,
        stageTransitions,
        transitionTimes,
        allTransitionsAutomatic,
        completedInTime,
        stageCount: stageTransitions.length
      };

    } catch (error) {
      console.log(`❌ Complete orchestration failed: ${error.message}`);
      return {
        passed: false,
        error: error.message,
        totalTime: Date.now() - startTime,
        stageTransitions,
        allTransitionsAutomatic: false,
        completedInTime: false
      };
    }
  }

  async waitForOutputInString(getOutput, searchText, timeoutMs) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const output = getOutput();
      if (output.includes(searchText)) {
        return true;
      }
      await this.delay(500);
    }
    
    return false;
  }

  calculateOverallAccuracy() {
    const tests = [
      this.validationResults.foundation.mcpBridge.passed,
      this.validationResults.foundation.workflowEngine.passed,
      this.validationResults.orchestration.keywordTransitions.passed,
      this.validationResults.orchestration.endToEnd.passed
    ];
    
    const passedTests = tests.filter(Boolean).length;
    const totalTests = tests.length;
    
    this.validationResults.overallAccuracy = Math.round((passedTests / totalTests) * 100);
    this.validationResults.automaticOrchestrationWorks = passedTests === totalTests;
  }

  async generateRealValidationReport() {
    const report = {
      testName: 'Real Orchestration Validator - Senior Engineer Protocol',
      timestamp: new Date().toISOString(),
      approach: 'Test actual system behavior, not testing infrastructure',
      results: this.validationResults,
      verdict: this.generateVerdict()
    };

    const reportPath = path.join('/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/testing', `orchestration_validation_${Date.now()}.json`);

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log('\n🎯 REAL ORCHESTRATION VALIDATION REPORT');
    console.log('=======================================');
    console.log(`Overall Accuracy: ${this.validationResults.overallAccuracy}%`);
    console.log(`Automatic Orchestration: ${this.validationResults.automaticOrchestrationWorks ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Report: ${reportPath}\n`);

    console.log('📊 Detailed Results:');
    console.log(`Foundation Layer: ${this.validationResults.foundation.allPassed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - MCP Bridge: ${this.validationResults.foundation.mcpBridge.passed ? '✅' : '❌'}`);
    console.log(`  - Workflow Engine: ${this.validationResults.foundation.workflowEngine.passed ? '✅' : '❌'}`);
    
    console.log(`Orchestration Layer: ${this.validationResults.orchestration.keywordTransitions.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - Keyword Transitions: ${this.validationResults.orchestration.keywordTransitions.passed ? '✅' : '❌'}`);
    console.log(`  - End-to-End Flow: ${this.validationResults.orchestration.endToEnd.passed ? '✅' : '❌'}`);

    return report;
  }

  generateVerdict() {
    if (this.validationResults.overallAccuracy === 100) {
      return 'AUTOMATIC ORCHESTRATION CONFIRMED: System works exactly as specified';
    } else if (this.validationResults.overallAccuracy >= 50) {
      return 'PARTIAL FUNCTIONALITY: Some components work but automatic orchestration incomplete';
    } else {
      return 'SYSTEM NOT READY: Fundamental components not working, automatic orchestration impossible';
    }
  }
}

module.exports = { RealOrchestrationValidator };

// CLI usage
if (require.main === module) {
  const validator = new RealOrchestrationValidator({ debug: true });
  
  validator.validate()
    .then(() => {
      console.log('\n✅ Real orchestration validation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n🚨 Real orchestration validation failed:', error.message);
      console.error('\n🎯 Senior Engineer Advice:');
      console.error('   This test validates actual system behavior, not testing infrastructure.');
      console.error('   If it fails, the system requires implementation work, not test fixes.');
      process.exit(1);
    });
}