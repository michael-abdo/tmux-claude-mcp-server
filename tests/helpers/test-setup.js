/**
 * Global test setup
 * This file is imported at the beginning of test files to set up mocks
 */

import { createRequire } from 'module';
import { RedisMock, createClient } from '../mocks/redis-mock.js';

// Create a require function for CommonJS modules
const require = createRequire(import.meta.url);

// Store original modules
const originalModules = {
  redis: null
};

/**
 * Setup Redis mocking for tests
 */
export function setupRedisMock() {
  // Check if we're in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.warn('setupRedisMock called outside of test environment');
    return;
  }

  // Mock the redis module
  const Module = require('module');
  const originalRequire = Module.prototype.require;

  Module.prototype.require = function(id) {
    if (id === 'redis') {
      return {
        createClient: (options = {}) => {
          console.log('[TEST] Creating mock Redis client');
          return createClient();
        }
      };
    }
    return originalRequire.apply(this, arguments);
  };

  // Also handle ES module imports by intercepting the redis import
  if (typeof global !== 'undefined') {
    global.mockRedis = true;
  }
}

/**
 * Setup test environment
 */
export function setupTestEnvironment() {
  // Set NODE_ENV if not set
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'test';
  }

  // Setup Redis mock
  setupRedisMock();

  // Disable console warnings in tests unless DEBUG is set
  if (!process.env.DEBUG) {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      // Filter out specific warnings
      const message = args[0]?.toString() || '';
      if (message.includes('Redis') || message.includes('Git integration failed')) {
        return; // Suppress these warnings in tests
      }
      originalWarn.apply(console, args);
    };
  }

  // Set test-specific timeouts
  if (typeof global !== 'undefined' && global.setTimeout) {
    // Store original setTimeout for restoration
    global.originalSetTimeout = global.setTimeout;
  }
}

/**
 * Cleanup test environment
 */
export function cleanupTestEnvironment() {
  // Restore console.warn if modified
  // Restore setTimeout if modified
  // Clean up any global mocks
}

// Auto-setup if this is imported
setupTestEnvironment();