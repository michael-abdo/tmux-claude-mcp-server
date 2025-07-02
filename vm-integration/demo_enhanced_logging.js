#!/usr/bin/env node

/**
 * Enhanced Logging Demo - Demonstrates comprehensive logging and visibility
 * 
 * Shows the robust logging system with correlation IDs, performance metrics,
 * audit trails, and security logging for all VM operations
 */

import { VMLogger, BatchLogger, operationContext } from './utils/logger.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Demo enhanced logging capabilities
 */
async function runLoggingDemo() {
  console.log('🎬 Enhanced Logging System Demo');
  console.log('═'.repeat(60));
  console.log('This demo shows comprehensive logging with full traceability');
  console.log('Watch the logs in: vm-integration/logs/vm/\n');

  const logger = new VMLogger('demo');

  // Demo 1: Basic operation with correlation tracking
  console.log('📋 Demo 1: Correlated Operation Logging');
  console.log('-'.repeat(40));
  
  const op1 = logger.startOperation('vm_create', {
    vmName: 'demo-logging-vm',
    requestedBy: 'demo-user',
    instanceType: 'm5.large'
  });

  logger.info('VM creation parameters validated', op1, {
    instanceType: 'm5.large',
    spot: true,
    estimatedCost: '$0.048/hour'
  });

  logger.logSecurityEvent('ssh_key_access', op1, {
    keyName: 'demo-key',
    action: 'validate_permissions'
  });

  logger.logCostEvent('cost_estimation_completed', op1, {
    estimated: { hourly: 0.048, daily: 1.15, monthly: 34.56 },
    instanceType: 'm5.large',
    spot: true,
    region: 'us-east-1'
  });

  // Simulate some work
  await new Promise(resolve => setTimeout(resolve, 100));

  logger.completeOperation(op1, {
    instanceId: 'i-demo1234567890abcdef',
    publicIp: '54.123.45.67',
    finalStatus: 'running'
  });

  console.log('✅ Demo 1 complete - Check logs/vm/vm-main.log for correlated entries\n');

  // Demo 2: Error handling with context
  console.log('📋 Demo 2: Enhanced Error Logging');
  console.log('-'.repeat(40));

  const op2 = logger.startOperation('vm_terminate', {
    vmName: 'non-existent-vm',
    requestedBy: 'demo-user'
  });

  try {
    // Simulate an error
    throw new Error('Instance not found in AWS');
  } catch (error) {
    logger.failOperation(op2, error, {
      vmName: 'non-existent-vm',
      region: 'us-east-1',
      awsErrorCode: 'InvalidInstanceID.NotFound',
      retryAttempt: 1
    });
  }

  console.log('✅ Demo 2 complete - Check logs/vm/vm-error.log for detailed error context\n');

  // Demo 3: Batch operation logging
  console.log('📋 Demo 3: Batch Operation Tracking');
  console.log('-'.repeat(40));

  const batchLogger = new BatchLogger('bulk_vm_creation', 3);

  for (let i = 1; i <= 3; i++) {
    const opId = logger.startOperation('vm_create', {
      vmName: `batch-vm-${i}`,
      batchId: batchLogger.batchId
    });

    batchLogger.addOperation(opId, `batch-vm-${i}`);

    // Simulate work with random success/failure
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const success = Math.random() > 0.3; // 70% success rate
    
    if (success) {
      logger.completeOperation(opId, {
        instanceId: `i-batch${i}1234567890`,
        status: 'running'
      });
    } else {
      logger.failOperation(opId, new Error('Capacity not available'), {
        awsErrorCode: 'InsufficientInstanceCapacity'
      });
    }

    batchLogger.completeOperation(opId, success);
  }

  console.log('✅ Demo 3 complete - Check logs/vm/vm-audit.log for batch summary\n');

  // Demo 4: Performance monitoring
  console.log('📋 Demo 4: Performance Metrics Logging');
  console.log('-'.repeat(40));

  const op4 = logger.startOperation('vm_list_with_metrics', {
    filterCount: 50,
    includeTerminated: true
  });

  // Simulate expensive operation
  logger.debug('Starting instance enumeration', op4, {
    region: 'us-east-1',
    maxResults: 100
  });

  await new Promise(resolve => setTimeout(resolve, 150));

  logger.info('AWS API calls completed', op4, {
    apiCallCount: 3,
    instancesFound: 47,
    dataTransferred: '2.3KB'
  });

  logger.completeOperation(op4, {
    instanceCount: 47,
    filteredCount: 45,
    performanceMetrics: {
      awsApiLatency: 140,
      dataProcessingTime: 10
    }
  });

  console.log('✅ Demo 4 complete - Check logs/vm/vm-performance.log\n');

  // Demo 5: Security event logging
  console.log('📋 Demo 5: Security Event Logging');
  console.log('-'.repeat(40));

  logger.logSecurityEvent('ssh_key_generation', null, {
    keyName: 'demo-new-key',
    keyType: 'ed25519',
    user: 'demo-user',
    purpose: 'vm_access'
  });

  logger.logSecurityEvent('security_group_modification', null, {
    securityGroup: 'sg-demo123',
    action: 'add_ssh_rule',
    sourceIp: '192.168.1.100/32',
    authorized: true
  });

  logger.logSecurityEvent('instance_access_granted', null, {
    instanceId: 'i-demo1234567890',
    user: 'demo-user',
    method: 'ssh',
    sourceIp: '192.168.1.100'
  });

  console.log('✅ Demo 5 complete - Check logs/vm/vm-security.log\n');

  // Demo 6: Show log aggregation capabilities
  console.log('📋 Demo 6: Log Analysis & Traceability');
  console.log('-'.repeat(40));
  
  console.log('Log file locations:');
  console.log('  📄 Main logs:        logs/vm/vm-main.log');
  console.log('  📄 Audit trail:      logs/vm/vm-audit.log');
  console.log('  📄 Performance:      logs/vm/vm-performance.log');
  console.log('  📄 Security events:  logs/vm/vm-security.log');
  console.log('  📄 Error details:    logs/vm/vm-error.log');
  console.log('  📄 Exceptions:       logs/vm/exceptions.log');

  console.log('\nCorrelation tracking:');
  console.log('  🔗 Every operation has a unique correlation ID');
  console.log('  🔗 All related log entries share the same ID');
  console.log('  🔗 Full end-to-end traceability across components');

  console.log('\nStructured logging benefits:');
  console.log('  📊 JSON format for easy parsing and analysis');
  console.log('  📊 Consistent field schemas across all logs');
  console.log('  📊 Ready for log aggregation systems (ELK, Splunk)');
  console.log('  📊 Automatic performance metrics collection');

  console.log('\nProduction readiness:');
  console.log('  🚀 Log rotation and size management');
  console.log('  🚀 Environment-specific log levels');
  console.log('  🚀 Audit compliance for security requirements');
  console.log('  🚀 Cost tracking and optimization data');

  console.log('\n🎉 Enhanced Logging Demo Complete!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('  ✅ Correlation IDs for end-to-end traceability');
  console.log('  ✅ Structured JSON logging with consistent schemas');
  console.log('  ✅ Performance metrics and timing data');
  console.log('  ✅ Comprehensive audit trail for compliance');
  console.log('  ✅ Security-sensitive operation tracking');
  console.log('  ✅ Error context with full stack traces');
  console.log('  ✅ Batch operation coordination logging');
  console.log('  ✅ Cost tracking and optimization data');

  console.log('\n📚 Next Steps:');
  console.log('  1. Examine log files to see structured output');
  console.log('  2. Configure log levels via VM_LOG_LEVEL env var');
  console.log('  3. Set up log aggregation for production use');
  console.log('  4. Create alerting based on error patterns');
}

// Example of how to read and analyze logs programmatically
function showLogAnalysisExample() {
  console.log('\n📋 Bonus: Log Analysis Example');
  console.log('-'.repeat(40));
  
  console.log('Example log aggregation queries:');
  console.log('');
  
  console.log('# Find all operations by correlation ID:');
  console.log('grep "operationId":"<ID>" logs/vm/*.log');
  console.log('');
  
  console.log('# Performance analysis:');
  console.log('cat logs/vm/vm-performance.log | jq ".duration" | sort -n');
  console.log('');
  
  console.log('# Security events in last hour:');
  console.log('cat logs/vm/vm-security.log | jq "select(.timestamp > \\"<timestamp>\\")"');
  console.log('');
  
  console.log('# Cost tracking:');
  console.log('cat logs/vm/vm-audit.log | jq "select(.event == \\"cost_event\\") | .estimatedCost"');
  console.log('');
  
  console.log('# Error pattern analysis:');
  console.log('cat logs/vm/vm-error.log | jq ".error.message" | sort | uniq -c');
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  runLoggingDemo()
    .then(() => showLogAnalysisExample())
    .catch(error => {
      console.error('Demo error:', error);
      process.exit(1);
    });
}

export default runLoggingDemo;