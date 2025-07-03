# GitHub Organization Standards Cleanup Plan

## Issues Identified

### 1. Naming Convention Inconsistencies
- **Problem**: Mix of snake_case and camelCase in src/
- **Standard**: JavaScript projects should use camelCase for files
- **Files to rename**:
  - `ai_conflict_resolver.js` → `aiConflictResolver.js`
  - `atomic_git_operations.js` → `atomicGitOperations.js`
  - `auto_scaler.js` → `autoScaler.js`
  - `circuit_breaker.js` → `circuitBreaker.js`
  - `distributed_tracer.js` → `distributedTracer.js`
  - `enhanced_mcp_tools.js` → `enhancedMcpTools.js`
  - `git_branch_manager.js` → `gitBranchManager.js`
  - `health_monitor.js` → `healthMonitor.js`
  - `instance_manager.js` → `instanceManager.js`
  - `job_queue.js` → `jobQueue.js`
  - `job_result_aggregator.js` → `jobResultAggregator.js`
  - `mcp_config_generator.js` → `mcpConfigGenerator.js`
  - `mcp_tools.js` → `mcpTools.js`
  - `monitoring_dashboard.js` → `monitoringDashboard.js`
  - `optimized_instance_manager.js` → `optimizedInstanceManager.js`
  - `parallel_executor.js` → `parallelExecutor.js`
  - `performance_mcp_tools.js` → `performanceMcpTools.js`
  - `performance_monitor.js` → `performanceMonitor.js`
  - `performance_optimizer.js` → `performanceOptimizer.js`
  - `redis_state_store.js` → `redisStateStore.js`
  - `reliable_tmux_sender.js` → `reliableTmuxSender.js`
  - `shared_workspace_ai_integration.js` → `sharedWorkspaceAiIntegration.js`
  - `shared_workspace_git_manager.js` → `sharedWorkspaceGitManager.js`
  - `shared_workspace_mcp_tools.js` → `sharedWorkspaceMcpTools.js`
  - `simple_mcp_server.js` → `simpleMcpServer.js`
  - `tmux_interface.js` → `tmuxInterface.js`
  - `todo_monitor.js` → `todoMonitor.js`

### 2. Test Files in Wrong Location
- **Problem**: Test files in `docs/testing/` instead of `tests/`
- **Action**: Move all test files from `docs/testing/` to appropriate test directories

### 3. Unorganized Test Structure
- **Problem**: All tests mixed in single directory
- **Solution**: Create subdirectories:
  ```
  tests/
  ├── unit/          # Unit tests
  ├── integration/   # Integration tests
  ├── e2e/          # End-to-end tests
  ├── performance/   # Performance tests
  ├── fixtures/      # Test fixtures
  └── helpers/       # Test utilities
  ```

### 4. Legacy/Development Files
- **Problem**: Phase-specific files suggest incomplete refactoring
- **Files to review**:
  - `phase1_simple_mode.js`
  - `phase3_manager.js`

### 5. Missing Documentation
- **Problem**: Some directories lack README files
- **Add README.md to**:
  - `src/` - Explain source code structure
  - `scripts/` - Document available scripts
  - `tests/` - Testing guide

### 6. Root Directory Clutter
- **Problem**: Multiple similar documentation files
- **Consolidate**:
  - Keep README.md as main entry
  - Move others to docs/ or merge content

## Implementation Order

1. **Step 1**: Move test files from docs/testing/ to tests/
2. **Step 2**: Reorganize tests into subdirectories
3. **Step 3**: Rename source files to camelCase
4. **Step 4**: Add missing README files
5. **Step 5**: Review and consolidate legacy files
6. **Step 6**: Update all imports/requires after renaming

## GitHub Best Practices to Implement

1. **Consistent file naming** (camelCase for JS)
2. **Clear directory structure** with READMEs
3. **Organized test hierarchy**
4. **No test files in documentation**
5. **Clean root directory**
6. **Proper .gitignore coverage**
7. **Clear contribution guidelines**