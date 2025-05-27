# Implementation Plan for Test Architecture Improvements

## Overview

This plan addresses the fundamental architectural issues preventing tests from passing. The core problem is tight coupling to external resources (Redis, file system, network) which causes timeouts in test environments.

## Phase 1: Immediate Fixes (1-2 hours)

### 1.1 Global Redis Mocking
Create a test setup file that mocks Redis at the module level:

```javascript
// tests/setup/redis-mock.js
import { jest } from '@jest/globals';
import RedisMock from 'redis-mock';

// Mock the entire redis module
jest.mock('redis', () => ({
  createClient: () => RedisMock.createClient()
}));

// Also mock ioredis if used
jest.mock('ioredis', () => RedisMock);
```

### 1.2 Environment-Based Initialization
Add NODE_ENV checks to prevent Redis initialization in tests:

```javascript
// src/optimized_instance_manager.js
class OptimizedInstanceManager extends InstanceManager {
  constructor(stateDir = './state', options = {}) {
    const testMode = process.env.NODE_ENV === 'test';
    super(stateDir, { 
      ...options, 
      useRedis: !testMode && (options.useRedis !== false)
    });
    
    if (!testMode) {
      this.initializeRedis();
    }
  }
  
  initializeRedis() {
    if (this.options.useRedis === false) return;
    // Existing Redis initialization
  }
}
```

### 1.3 Test Script Updates
Update package.json to set NODE_ENV:

```json
{
  "scripts": {
    "test": "NODE_ENV=test node --test tests/**/*.js",
    "test:unit": "NODE_ENV=test node --test tests/unit/**/*.js",
    "test:integration": "NODE_ENV=production node --test tests/integration/**/*.js",
    "test:with-redis": "redis-server --daemonize yes && npm test && redis-cli shutdown"
  }
}
```

## Phase 2: Medium-Term Improvements (4-6 hours)

### 2.1 Dependency Injection for OptimizedInstanceManager

```javascript
// src/optimized_instance_manager.js
class OptimizedInstanceManager extends InstanceManager {
  constructor(stateDir = './state', options = {}, dependencies = {}) {
    super(stateDir, options);
    
    // Allow injection of dependencies
    this.redis = dependencies.redis || null;
    this.createRedisClient = dependencies.createRedisClient || this._defaultCreateRedisClient;
    this.fs = dependencies.fs || require('fs').promises;
    
    // Initialize only if not injected
    if (!this.redis && options.useRedis !== false) {
      this.initializeRedis();
    }
  }
  
  _defaultCreateRedisClient() {
    const redis = require('redis');
    return redis.createClient({
      host: this.options.redisHost || 'localhost',
      port: this.options.redisPort || 6379
    });
  }
}
```

### 2.2 Factory Pattern Implementation

```javascript
// src/factories/instance_manager_factory.js
export class InstanceManagerFactory {
  static create(type = 'default', options = {}) {
    const isTest = process.env.NODE_ENV === 'test';
    
    switch (type) {
      case 'optimized':
        if (isTest) {
          return this.createMockOptimizedManager(options);
        }
        return new OptimizedInstanceManager(options.stateDir, options);
        
      case 'basic':
      default:
        return new InstanceManager(options.stateDir, options);
    }
  }
  
  static createMockOptimizedManager(options) {
    const mockRedis = {
      get: async () => null,
      set: async () => 'OK',
      del: async () => 1,
      keys: async () => [],
      quit: async () => {}
    };
    
    return new OptimizedInstanceManager(
      options.stateDir || './test-state',
      { ...options, useRedis: false },
      { redis: mockRedis }
    );
  }
}
```

### 2.3 Monitoring Dashboard Refactoring

```javascript
// src/monitoring_dashboard.js
class MonitoringDashboard {
  constructor(port = 3001, dependencies = {}) {
    this.port = port;
    
    // Accept injected instance manager
    this.instanceManager = dependencies.instanceManager || 
      this._createDefaultInstanceManager();
    
    // Allow disabling server creation
    this.autoStart = dependencies.autoStart !== false;
    
    if (this.autoStart) {
      this.setupServer();
    }
  }
  
  _createDefaultInstanceManager() {
    // Use factory instead of direct instantiation
    const { InstanceManagerFactory } = require('./factories/instance_manager_factory');
    return InstanceManagerFactory.create('optimized');
  }
  
  setupServer() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }
}
```

## Phase 3: Test Refactoring (2-3 hours)

### 3.1 Performance Test Updates

```javascript
// tests/test_performance_optimizations_refactored.js
import { test } from 'node:test';
import assert from 'node:assert';
import { InstanceManagerFactory } from '../src/factories/instance_manager_factory.js';

test.describe('Performance Optimizations', () => {
  let manager;
  
  test.beforeEach(() => {
    // Use factory to get test-appropriate instance
    manager = InstanceManagerFactory.create('optimized', {
      stateDir: './test-state',
      useRedis: false // Explicitly disable Redis
    });
  });
  
  test('should spawn multiple instances in parallel', async () => {
    // Mock the spawn functionality
    const spawnResults = [];
    manager.spawnInstance = async (options) => {
      const instance = {
        id: options.instanceId || `test_${Date.now()}`,
        role: options.role,
        status: 'active',
        startTime: Date.now()
      };
      spawnResults.push(instance);
      return instance;
    };
    
    // Test parallel spawning
    const instances = await manager.spawnParallel([
      { role: 'specialist', context: 'Test 1' },
      { role: 'specialist', context: 'Test 2' },
      { role: 'specialist', context: 'Test 3' }
    ]);
    
    assert.strictEqual(instances.length, 3);
  });
});
```

### 3.2 Monitoring Dashboard Test Updates

```javascript
// tests/test_monitoring_dashboard_refactored.js
import { test } from 'node:test';
import assert from 'node:assert';
import { MonitoringDashboard } from '../src/monitoring_dashboard.js';
import { InstanceManagerFactory } from '../src/factories/instance_manager_factory.js';

test.describe('Monitoring Dashboard', () => {
  let dashboard;
  let mockInstanceManager;
  
  test.beforeEach(() => {
    // Create mock instance manager
    mockInstanceManager = InstanceManagerFactory.create('optimized', {
      stateDir: './test-state',
      useRedis: false
    });
    
    // Create dashboard with mocked dependencies
    dashboard = new MonitoringDashboard(0, {
      instanceManager: mockInstanceManager,
      autoStart: false // Don't start server automatically
    });
  });
  
  test('should initialize without starting server', () => {
    assert.ok(dashboard);
    assert.strictEqual(dashboard.app, undefined);
  });
  
  test('should handle instance metrics', async () => {
    // Mock instance data
    mockInstanceManager.getAllInstances = async () => [
      { id: 'test_1', role: 'manager', status: 'active' },
      { id: 'test_2', role: 'specialist', status: 'active' }
    ];
    
    const metrics = await dashboard.getInstanceMetrics();
    assert.strictEqual(metrics.total, 2);
    assert.strictEqual(metrics.byRole.manager, 1);
    assert.strictEqual(metrics.byRole.specialist, 1);
  });
});
```

## Phase 4: Long-Term Architecture (1-2 days)

### 4.1 Interface Definitions

```typescript
// src/interfaces/instance_manager.ts
export interface IInstanceManager {
  spawnInstance(options: SpawnOptions): Promise<Instance>;
  terminateInstance(instanceId: string): Promise<void>;
  getAllInstances(): Promise<Instance[]>;
}

export interface ICacheProvider {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface IFileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string, options?: any): Promise<void>;
}
```

### 4.2 Modular Architecture

```javascript
// src/core/instance_manager_core.js
export class InstanceManagerCore {
  constructor(dependencies) {
    this.cache = dependencies.cache;
    this.fs = dependencies.fs;
    this.processManager = dependencies.processManager;
  }
  
  async spawnInstance(options) {
    // Core logic without external dependencies
    const instance = await this.processManager.spawn(options);
    await this.cache.set(`instance:${instance.id}`, instance);
    return instance;
  }
}

// src/providers/redis_cache_provider.js
export class RedisCacheProvider {
  constructor(redisClient) {
    this.client = redisClient;
  }
  
  async get(key) {
    return JSON.parse(await this.client.get(key));
  }
  
  async set(key, value, ttl = 3600) {
    await this.client.setex(key, ttl, JSON.stringify(value));
  }
}

// src/providers/memory_cache_provider.js
export class MemoryCacheProvider {
  constructor() {
    this.cache = new Map();
  }
  
  async get(key) {
    return this.cache.get(key);
  }
  
  async set(key, value) {
    this.cache.set(key, value);
  }
}
```

## Implementation Timeline

### Day 1 (Immediate)
- [ ] Implement Phase 1.1: Global Redis mocking
- [ ] Implement Phase 1.2: Environment-based initialization
- [ ] Implement Phase 1.3: Update test scripts
- [ ] Run tests to verify fixes

### Day 2-3 (Medium-term)
- [ ] Implement Phase 2.1: Dependency injection
- [ ] Implement Phase 2.2: Factory pattern
- [ ] Implement Phase 2.3: Dashboard refactoring
- [ ] Implement Phase 3: Test refactoring

### Week 2 (Long-term)
- [ ] Design complete interface hierarchy
- [ ] Implement modular providers
- [ ] Refactor all managers to use interfaces
- [ ] Create comprehensive test suite

## Success Criteria

1. **Immediate**: All tests pass without Redis running
2. **Medium-term**: Clear separation between unit and integration tests
3. **Long-term**: Fully testable architecture with dependency injection

## Risk Mitigation

1. **Backward Compatibility**: Keep existing APIs, add new ones
2. **Gradual Migration**: Implement alongside existing code
3. **Feature Flags**: Use environment variables to toggle new architecture
4. **Documentation**: Update as changes are made

## Testing Strategy

### Unit Tests
- Mock all external dependencies
- Test business logic in isolation
- Fast execution (< 5 seconds total)

### Integration Tests
- Use real Redis in Docker container
- Test actual tmux operations
- Separate CI pipeline

### E2E Tests
- Full system with all components
- Manual trigger only
- Production-like environment