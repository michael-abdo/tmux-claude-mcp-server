#!/usr/bin/env node

/**
 * Workflow Validation Runner - Senior Engineer Protocol
 * Project-local testing that validates actual system behavior
 */

const { RealOrchestrationValidator } = require('./real_orchestration_validator.js');
const fs = require('fs').promises;
const path = require('path');

class WorkflowValidationRunner {
  constructor() {
    this.projectRoot = '/home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows';
  }

  async runValidation() {
    console.log('\n🎯 Workflow Validation Runner - Senior Engineer Protocol');
    console.log('=======================================================');
    console.log('Project-local testing of automatic workflow orchestration\n');

    try {
      // Step 1: Reload constraints from project local claude.md
      await this.reloadProjectConstraints();

      // Step 2: Execute real orchestration validation
      console.log('🎯 Executing Real Orchestration Validation...');
      const validator = new RealOrchestrationValidator({ debug: true });
      const result = await validator.validate();

      console.log('\n🎯 Workflow validation completed');
      return result;

    } catch (error) {
      console.error(`\n🚨 Workflow validation failed: ${error.message}`);
      console.error('\n🎯 Senior Engineer Protocol:');
      console.error('   This failure indicates the system needs implementation work.');
      console.error('   Do not fix the tests - fix the system to pass the tests.');
      throw error;
    }
  }

  async reloadProjectConstraints() {
    try {
      const constraintsPath = path.join(this.projectRoot, 'claude.md');
      const constraints = await fs.readFile(constraintsPath, 'utf8');
      
      console.log('📋 Constraints reloaded from project claude.md');
      
      // Validate we have the correct constraints
      if (!constraints.includes('Senior Engineer Validation Protocol')) {
        throw new Error('Project claude.md missing Senior Engineer Protocol');
      }

      if (!constraints.includes('Test Reality, Not Testing Infrastructure')) {
        throw new Error('Project claude.md missing core validation principle');
      }

      console.log('✅ Senior Engineer constraints validated\n');
      return constraints;

    } catch (error) {
      throw new Error(`Failed to load project constraints: ${error.message}`);
    }
  }

  showUsage() {
    console.log('\n🎯 Workflow Validation Runner');
    console.log('Usage: node run_validation.js [command]');
    console.log('\nCommands:');
    console.log('  validate    - Run complete orchestration validation (default)');
    console.log('  help        - Show this help message');
    console.log('\nProject Structure:');
    console.log('  /home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/claude.md                     # Constraints');
    console.log('  /home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/testing/real_orchestration_validator.js # Validator');
    console.log('  /home/ubuntu/dev_ops/tools/tmux-claude-mcp-server/workflows/testing/run_validation.js     # This runner');
    console.log('\nSenior Engineer Protocol:');
    console.log('  1. Tests actual system behavior, not testing infrastructure');
    console.log('  2. Foundation layer must pass before orchestration testing');
    console.log('  3. 100% accuracy = complete automatic orchestration working');
    console.log('  4. <100% accuracy = system needs implementation work\n');
  }
}

// CLI execution
async function main() {
  const command = process.argv[2] || 'validate';
  const runner = new WorkflowValidationRunner();
  
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n🚨 Validation interrupted! Exiting...');
    process.exit(0);
  });
  
  try {
    switch (command.toLowerCase()) {
      case 'validate':
        await runner.runValidation();
        break;
        
      case 'help':
      case '--help':
      case '-h':
        runner.showUsage();
        break;
        
      default:
        console.error(`❌ Unknown command: ${command}`);
        runner.showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n🚨 Workflow validation execution failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { WorkflowValidationRunner };