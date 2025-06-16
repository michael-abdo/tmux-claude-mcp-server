#!/usr/bin/env node

/**
 * Workflow Tester - Automated testing utility for workflows
 * Validates workflow files and runs integration tests
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const WorkflowEngine = require('./workflow_engine.cjs');
const WorkflowManager = require('./workflow_manager.cjs');

class WorkflowTester {
  constructor(options = {}) {
    this.options = options;
    this.manager = new WorkflowManager(options);
    this.testResults = [];
  }
  
  async runAllTests() {
    console.log('🧪 Starting Workflow System Tests\n');
    
    const tests = [
      this.testWorkflowDiscovery.bind(this),
      this.testWorkflowValidation.bind(this),
      this.testBasicWorkflowExecution.bind(this),
      this.testErrorHandling.bind(this),
      this.testContextManagement.bind(this)
    ];
    
    for (const test of tests) {
      try {
        await test();
      } catch (error) {
        this.recordResult(test.name, false, error.message);
      }
    }
    
    this.printSummary();
    return this.testResults;
  }
  
  async testWorkflowDiscovery() {
    const testName = 'Workflow Discovery';
    console.log(`🔍 Testing: ${testName}`);
    
    try {
      const workflows = await this.manager.discoverWorkflows();
      
      if (workflows.length === 0) {
        throw new Error('No workflows discovered');
      }
      
      // Verify expected workflows exist
      const expectedWorkflows = [
        'quick_analysis',
        'execute_compare_commit',
        'simple_test'
      ];
      
      for (const expected of expectedWorkflows) {
        const found = workflows.find(w => w.id === expected);
        if (!found) {
          throw new Error(`Expected workflow not found: ${expected}`);
        }
      }
      
      console.log(`✅ Found ${workflows.length} workflows`);
      this.recordResult(testName, true, `Discovered ${workflows.length} workflows`);
      
    } catch (error) {
      console.log(`❌ ${testName} failed: ${error.message}`);
      this.recordResult(testName, false, error.message);
    }
  }
  
  async testWorkflowValidation() {
    const testName = 'Workflow Validation';
    console.log(`🔍 Testing: ${testName}`);
    
    try {
      const workflows = await this.manager.discoverWorkflows();
      let validCount = 0;
      let totalCount = workflows.length;
      
      for (const workflow of workflows) {
        const validation = await this.manager.validateWorkflow(workflow.path);
        if (validation.valid) {
          validCount++;
        } else {
          console.log(`⚠️ Invalid workflow ${workflow.id}: ${validation.errors.join(', ')}`);
        }
      }
      
      if (validCount === 0) {
        throw new Error('No valid workflows found');
      }
      
      console.log(`✅ ${validCount}/${totalCount} workflows are valid`);
      this.recordResult(testName, true, `${validCount}/${totalCount} workflows valid`);
      
    } catch (error) {
      console.log(`❌ ${testName} failed: ${error.message}`);
      this.recordResult(testName, false, error.message);
    }
  }
  
  async testBasicWorkflowExecution() {
    const testName = 'Basic Workflow Execution';
    console.log(`🔍 Testing: ${testName}`);
    
    try {
      // Create a simple test workflow
      const testWorkflow = {
        name: 'Test Workflow',
        version: '1.0',
        settings: {
          useTaskIds: false,
          poll_interval: 1,
          timeout: 10
        },
        stages: [
          {
            id: 'test_stage',
            name: 'Test Stage',
            prompt: 'Respond with: TEST_SUCCESS',
            trigger_keyword: 'TEST_SUCCESS',
            timeout: 5,
            on_success: [
              { action: 'complete_workflow' }
            ]
          }
        ]
      };
      
      // Write test workflow to temp file
      const testPath = path.join(__dirname, 'test_workflow_temp.yaml');
      await fs.writeFile(testPath, yaml.stringify(testWorkflow));
      
      // Validate it loads correctly
      const engine = new WorkflowEngine(testPath, { debug: false });
      await engine.initialize();
      
      // Clean up
      await fs.unlink(testPath);
      
      console.log(`✅ Workflow execution system functional`);
      this.recordResult(testName, true, 'Engine initialization successful');
      
    } catch (error) {
      console.log(`❌ ${testName} failed: ${error.message}`);
      this.recordResult(testName, false, error.message);
    }
  }
  
  async testErrorHandling() {
    const testName = 'Error Handling';
    console.log(`🔍 Testing: ${testName}`);
    
    try {
      // Test invalid YAML
      const invalidYamlPath = path.join(__dirname, 'invalid_test.yaml');
      await fs.writeFile(invalidYamlPath, 'invalid: yaml: content:');
      
      const validation = await this.manager.validateWorkflow(invalidYamlPath);
      if (validation.valid) {
        throw new Error('Expected validation to fail for invalid YAML');
      }
      
      // Clean up
      await fs.unlink(invalidYamlPath);
      
      console.log(`✅ Error handling works correctly`);
      this.recordResult(testName, true, 'Invalid workflows properly rejected');
      
    } catch (error) {
      console.log(`❌ ${testName} failed: ${error.message}`);
      this.recordResult(testName, false, error.message);
    }
  }
  
  async testContextManagement() {
    const testName = 'Context Management';
    console.log(`🔍 Testing: ${testName}`);
    
    try {
      const WorkflowContext = require('./workflow_context.cjs');
      
      // Test context creation and variable interpolation
      const context = new WorkflowContext({
        workflow: { name: 'Test Workflow' },
        vars: { test_var: 'test_value' }
      });
      
      // Test variable interpolation
      const template = 'Workflow: ${workflow.name}, Variable: ${vars.test_var}';
      const result = context.interpolate(template);
      const expected = 'Workflow: Test Workflow, Variable: test_value';
      
      if (result !== expected) {
        throw new Error(`Interpolation failed. Expected: ${expected}, Got: ${result}`);
      }
      
      // Test task ID mode
      context.setTaskIdMode(false);
      const taskIdTemplate = '${current_task_id}_KEYWORD';
      const cleanResult = context.interpolate(taskIdTemplate);
      
      if (cleanResult !== 'KEYWORD') {
        throw new Error(`Task ID removal failed. Expected: KEYWORD, Got: ${cleanResult}`);
      }
      
      console.log(`✅ Context management functional`);
      this.recordResult(testName, true, 'Variable interpolation and task ID handling work');
      
    } catch (error) {
      console.log(`❌ ${testName} failed: ${error.message}`);
      this.recordResult(testName, false, error.message);
    }
  }
  
  recordResult(testName, passed, message) {
    this.testResults.push({
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }
  
  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.message}`);
    });
    
    console.log(`\n🏆 ${passed}/${total} tests passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed! Workflow system is ready for production.');
    } else {
      console.log('⚠️ Some tests failed. Please review and fix issues before production use.');
    }
  }
  
  async generateTestReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.testResults.length,
        passed: this.testResults.filter(r => r.passed).length,
        failed: this.testResults.filter(r => !r.passed).length
      },
      results: this.testResults,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        workingDirectory: process.cwd()
      }
    };
    
    const reportPath = path.join(__dirname, '../../docs/workflow_test_report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📋 Test report saved: ${reportPath}`);
    
    return report;
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options = {
    debug: args.includes('--debug'),
    verbose: args.includes('--verbose')
  };
  
  if (args.includes('--help')) {
    console.log(`
Workflow Tester - Automated testing for workflow system

Usage:
  workflow_tester.cjs [options]

Options:
  --debug          Enable debug output
  --verbose        Show detailed test information
  --report         Generate JSON test report
  --help           Show this help

Examples:
  workflow_tester.cjs
  workflow_tester.cjs --debug --report
`);
    return;
  }
  
  try {
    const tester = new WorkflowTester(options);
    await tester.runAllTests();
    
    if (args.includes('--report')) {
      await tester.generateTestReport();
    }
    
    const passed = tester.testResults.filter(r => r.passed).length;
    const total = tester.testResults.length;
    
    process.exit(passed === total ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = WorkflowTester;