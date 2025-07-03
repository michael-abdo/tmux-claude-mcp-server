/**
 * Centralized Logging System for VM Integration
 * 
 * Provides structured, traceable logging with correlation IDs, performance metrics,
 * audit trails, and security-sensitive operation tracking
 */

import winston from 'winston';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const LOGS_DIR = join(__dirname, '../../logs/vm');
if (!existsSync(LOGS_DIR)) {
  mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Custom log formats
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, service, operationId, operation, ...meta }) => {
    let logLine = `${timestamp} [${level}]`;
    
    if (service) logLine += ` [${service}]`;
    if (operationId) logLine += ` [${operationId.slice(0, 8)}]`;
    if (operation) logLine += ` [${operation}]`;
    
    logLine += ` ${message}`;
    
    // Add metadata if present
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return logLine + metaStr;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create specialized loggers
 */
const createLogger = (name, filename, level = 'info') => {
  return winston.createLogger({
    level: process.env.VM_LOG_LEVEL || level,
    defaultMeta: { 
      service: `vm-${name}`,
      hostname: process.env.HOSTNAME || 'localhost',
      pid: process.pid
    },
    format: fileFormat,
    transports: [
      new winston.transports.File({ 
        filename: join(LOGS_DIR, filename),
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true
      }),
      new winston.transports.Console({
        level: process.env.VM_CONSOLE_LOG_LEVEL || 'info',
        format: consoleFormat
      })
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: join(LOGS_DIR, 'exceptions.log') })
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: join(LOGS_DIR, 'rejections.log') })
    ]
  });
};

// Specialized loggers
export const mainLogger = createLogger('main', 'vm-main.log');
export const auditLogger = createLogger('audit', 'vm-audit.log', 'info');
export const performanceLogger = createLogger('performance', 'vm-performance.log', 'info');
export const securityLogger = createLogger('security', 'vm-security.log', 'warn');
export const errorLogger = createLogger('error', 'vm-error.log', 'error');

/**
 * Operation Context Manager for correlation tracking
 */
class OperationContext {
  constructor() {
    this.contexts = new Map();
  }

  create(operation, metadata = {}) {
    const operationId = randomUUID();
    const context = {
      operationId,
      operation,
      startTime: Date.now(),
      metadata: {
        ...metadata,
        user: process.env.USER || 'system',
        sessionId: process.env.VM_SESSION_ID || 'default'
      }
    };
    
    this.contexts.set(operationId, context);
    
    mainLogger.info('Operation started', {
      operationId,
      operation,
      ...context.metadata
    });
    
    return operationId;
  }

  update(operationId, updates) {
    const context = this.contexts.get(operationId);
    if (context) {
      Object.assign(context.metadata, updates);
      
      mainLogger.debug('Operation updated', {
        operationId,
        updates
      });
    }
  }

  complete(operationId, success = true, result = {}) {
    const context = this.contexts.get(operationId);
    if (!context) return;

    const duration = Date.now() - context.startTime;
    
    // Log to main logger
    mainLogger.info('Operation completed', {
      operationId,
      operation: context.operation,
      success,
      duration,
      ...result
    });

    // Log to performance logger
    performanceLogger.info('Performance metrics', {
      operationId,
      operation: context.operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    });

    // Log to audit logger for important operations
    if (this.isAuditableOperation(context.operation)) {
      auditLogger.info('Auditable operation completed', {
        operationId,
        operation: context.operation,
        user: context.metadata.user,
        success,
        duration,
        ...result
      });
    }

    this.contexts.delete(operationId);
  }

  fail(operationId, error, context = {}) {
    const opContext = this.contexts.get(operationId);
    if (!opContext) return;

    const duration = Date.now() - opContext.startTime;
    
    // Enhanced error logging
    errorLogger.error('Operation failed', {
      operationId,
      operation: opContext.operation,
      duration,
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
      },
      context: {
        ...opContext.metadata,
        ...context
      }
    });

    // Also log to main logger
    mainLogger.error('Operation failed', {
      operationId,
      operation: opContext.operation,
      error: error.message,
      duration
    });

    this.contexts.delete(operationId);
  }

  get(operationId) {
    return this.contexts.get(operationId);
  }

  isAuditableOperation(operation) {
    const auditableOps = [
      'vm_create', 'vm_terminate', 'vm_start', 'vm_stop',
      'vm_create_image', 'vm_bulk_create', 'ssh_key_generate'
    ];
    return auditableOps.includes(operation);
  }
}

export const operationContext = new OperationContext();

/**
 * Enhanced Logger Class with correlation support
 */
export class VMLogger {
  constructor(category = 'vm') {
    this.category = category;
    this.logger = mainLogger;
  }

  /**
   * Start a tracked operation
   */
  startOperation(operation, metadata = {}) {
    return operationContext.create(operation, {
      category: this.category,
      ...metadata
    });
  }

  /**
   * Log with correlation context
   */
  log(level, message, operationId = null, metadata = {}) {
    const logData = {
      ...metadata,
      category: this.category
    };

    if (operationId) {
      logData.operationId = operationId;
      const context = operationContext.get(operationId);
      if (context) {
        logData.operation = context.operation;
      }
    }

    this.logger[level](message, logData);
  }

  info(message, operationId = null, metadata = {}) {
    this.log('info', message, operationId, metadata);
  }

  warn(message, operationId = null, metadata = {}) {
    this.log('warn', message, operationId, metadata);
  }

  error(message, operationId = null, metadata = {}) {
    this.log('error', message, operationId, metadata);
  }

  debug(message, operationId = null, metadata = {}) {
    this.log('debug', message, operationId, metadata);
  }

  /**
   * Log AWS CLI execution
   */
  logAWSCommand(operationId, command, metadata = {}) {
    const sanitizedCommand = this.sanitizeCommand(command);
    
    this.debug('AWS CLI command execution', operationId, {
      command: sanitizedCommand,
      region: metadata.region,
      commandType: this.getCommandType(command)
    });
  }

  /**
   * Log AWS CLI response
   */
  logAWSResponse(operationId, command, response, success = true) {
    const commandType = this.getCommandType(command);
    
    this.info('AWS CLI response received', operationId, {
      commandType,
      success,
      responseSize: JSON.stringify(response).length,
      hasInstanceId: response?.Instances?.[0]?.InstanceId ? true : false
    });
  }

  /**
   * Security-sensitive operation logging
   */
  logSecurityEvent(event, operationId = null, metadata = {}) {
    securityLogger.warn('Security event', {
      operationId,
      event,
      timestamp: new Date().toISOString(),
      ...metadata
    });
  }

  /**
   * Cost-related operation logging
   */
  logCostEvent(event, operationId = null, cost = {}) {
    auditLogger.info('Cost event', {
      operationId,
      event,
      estimatedCost: cost.estimated,
      instanceType: cost.instanceType,
      spot: cost.spot,
      region: cost.region,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Complete an operation successfully
   */
  completeOperation(operationId, result = {}) {
    operationContext.complete(operationId, true, result);
  }

  /**
   * Fail an operation
   */
  failOperation(operationId, error, context = {}) {
    operationContext.fail(operationId, error, context);
  }

  /**
   * Sanitize command for logging (remove sensitive data)
   */
  sanitizeCommand(command) {
    if (!Array.isArray(command)) return command;
    
    const sensitiveFlags = ['--user-data', '--key-name'];
    const sanitized = [...command];
    
    sensitiveFlags.forEach(flag => {
      const index = sanitized.indexOf(flag);
      if (index !== -1 && index + 1 < sanitized.length) {
        sanitized[index + 1] = '[REDACTED]';
      }
    });
    
    return sanitized.join(' ');
  }

  /**
   * Get command type for categorization
   */
  getCommandType(command) {
    if (!Array.isArray(command)) return 'unknown';
    
    const typeMap = {
      'run-instances': 'create',
      'describe-instances': 'describe',
      'terminate-instances': 'terminate',
      'stop-instances': 'stop',
      'start-instances': 'start',
      'create-image': 'image'
    };
    
    const action = command.find(cmd => Object.keys(typeMap).includes(cmd));
    return typeMap[action] || 'other';
  }
}

/**
 * State change logger for debugging
 */
export function logStateChange(category, before, after, operationId = null) {
  mainLogger.debug('State change detected', {
    operationId,
    category,
    before: before ? Object.keys(before) : null,
    after: after ? Object.keys(after) : null,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log aggregation helper for batch operations
 */
export class BatchLogger {
  constructor(batchOperation, expectedCount) {
    this.batchId = randomUUID();
    this.batchOperation = batchOperation;
    this.expectedCount = expectedCount;
    this.completedCount = 0;
    this.failedCount = 0;
    this.startTime = Date.now();
    this.operations = [];

    mainLogger.info('Batch operation started', {
      batchId: this.batchId,
      operation: batchOperation,
      expectedCount
    });
  }

  addOperation(operationId, name) {
    this.operations.push({ operationId, name, status: 'pending' });
    
    mainLogger.debug('Batch operation added', {
      batchId: this.batchId,
      operationId,
      name,
      totalOperations: this.operations.length
    });
  }

  completeOperation(operationId, success = true) {
    const operation = this.operations.find(op => op.operationId === operationId);
    if (operation) {
      operation.status = success ? 'completed' : 'failed';
      
      if (success) {
        this.completedCount++;
      } else {
        this.failedCount++;
      }

      mainLogger.info('Batch operation progress', {
        batchId: this.batchId,
        operationId,
        completed: this.completedCount,
        failed: this.failedCount,
        remaining: this.expectedCount - this.completedCount - this.failedCount
      });

      // Check if batch is complete
      if (this.completedCount + this.failedCount >= this.expectedCount) {
        this.completeBatch();
      }
    }
  }

  completeBatch() {
    const duration = Date.now() - this.startTime;
    
    auditLogger.info('Batch operation completed', {
      batchId: this.batchId,
      operation: this.batchOperation,
      duration,
      completed: this.completedCount,
      failed: this.failedCount,
      successRate: (this.completedCount / this.expectedCount) * 100
    });

    performanceLogger.info('Batch performance metrics', {
      batchId: this.batchId,
      operation: this.batchOperation,
      duration,
      operationCount: this.expectedCount,
      avgDurationPerOperation: duration / this.expectedCount
    });
  }
}

// Export default logger instance
export default new VMLogger('vm-integration');