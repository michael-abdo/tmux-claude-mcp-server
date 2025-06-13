# TmuxInterface Integration Plan

## Integration Architecture

### Component Selection Strategy

#### Session Discovery: TmuxInterface.listSessions()
```javascript
import { TmuxInterface } from '../src/tmux_interface.js';

const tmuxInterface = new TmuxInterface();
const sessions = await tmuxInterface.listSessions();
// Returns: [{name, windows, attached, id}, ...]
```

**Rationale:**
- ✅ Robust error handling with graceful degradation
- ✅ Structured output with session metadata
- ✅ Consistent with existing codebase patterns
- ✅ Handles "no sessions" case cleanly

#### Message Delivery: EnhancedTmuxInterface.sendCriticalMessage()
```javascript
import { EnhancedTmuxInterface } from '../src/reliable_tmux_sender.js';

const enhancedTmux = new EnhancedTmuxInterface();
await enhancedTmux.sendCriticalMessage(sessionName, message);
```

**Rationale:**
- ✅ Maximum reliability with bulletproof strategy
- ✅ Built-in retry logic and error handling
- ✅ Verification that message actually reached session
- ✅ Perfect for "Plz continue" critical messages

## Session Discovery Strategy

### Discovery Workflow
```javascript
async function discoverSessions(verbose = false) {
  if (verbose) console.log('🔍 Discovering tmux sessions...');
  
  const tmuxInterface = new TmuxInterface();
  const sessions = await tmuxInterface.listSessions();
  
  if (sessions.length === 0) {
    console.log('❌ No active tmux sessions found');
    console.log('💡 Start some tmux sessions and try again');
    process.exit(3); // Exit code 3: Session discovery error
  }
  
  if (verbose) {
    console.log(`✅ Found ${sessions.length} active tmux sessions:`);
    sessions.forEach(session => {
      console.log(`  - ${session.name} (${session.windows} windows, ${session.attached ? 'attached' : 'detached'})`);
    });
  } else {
    console.log(`✅ Found ${sessions.length} active tmux sessions`);
  }
  
  return sessions;
}
```

### Session Filtering Rules (Phase 1: All Sessions)
```javascript
function filterSessions(sessions, options = {}) {
  // Phase 1: Send to ALL sessions (simple and effective)
  // Future: Add filtering options like --pattern, --exclude
  
  return sessions.filter(session => {
    // Basic validation: session has valid name
    return session.name && typeof session.name === 'string';
  });
}
```

### Session Validation
```javascript
function validateSessions(sessions) {
  const validSessions = [];
  const invalidSessions = [];
  
  for (const session of sessions) {
    if (session.name && session.name.length > 0) {
      validSessions.push(session);
    } else {
      invalidSessions.push(session);
    }
  }
  
  if (invalidSessions.length > 0) {
    console.log(`⚠️  Found ${invalidSessions.length} invalid sessions (skipping)`);
  }
  
  return validSessions;
}
```

## Message Delivery Strategy

### Delivery Workflow
```javascript
async function deliverToAllSessions(sessions, message, options = {}) {
  const { verbose = false, dryRun = false } = options;
  
  if (dryRun) {
    console.log(`🧪 DRY RUN: Would send "${message}" to ${sessions.length} sessions`);
    return { successful: sessions.length, failed: 0, results: [] };
  }
  
  console.log(`📤 Sending message to ${sessions.length} sessions...`);
  
  const enhancedTmux = new EnhancedTmuxInterface();
  const results = [];
  let successful = 0;
  let failed = 0;
  
  // Send to all sessions with error handling
  for (const session of sessions) {
    try {
      if (verbose) console.log(`  🎯 Sending to ${session.name}...`);
      
      const success = await enhancedTmux.sendCriticalMessage(session.name, message);
      
      if (success) {
        if (verbose) console.log(`  ✓ Success: ${session.name}`);
        successful++;
        results.push({ session: session.name, success: true });
      } else {
        console.log(`  ✗ Failed: ${session.name} (delivery failed)`);
        failed++;
        results.push({ session: session.name, success: false, error: 'delivery_failed' });
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${session.name} (${error.message})`);
      failed++;
      results.push({ session: session.name, success: false, error: error.message });
    }
  }
  
  return { successful, failed, results };
}
```

### Performance Optimizations

#### Parallel Delivery (Future Enhancement)
```javascript
async function deliverToAllSessionsParallel(sessions, message, options = {}) {
  const { maxConcurrency = 10, verbose = false } = options;
  
  // Use p-queue for controlled concurrency
  const queue = new PQueue({ concurrency: maxConcurrency });
  
  const deliveryPromises = sessions.map(session => 
    queue.add(() => deliverToSingleSession(session, message, verbose))
  );
  
  const results = await Promise.allSettled(deliveryPromises);
  
  // Process results...
  return processDeliveryResults(results);
}
```

## Re-validation Strategy

### Execution Time Re-validation
```javascript
async function revalidateSessionsAtExecution(originalSessions, verbose = false) {
  if (verbose) console.log('🔍 Re-validating tmux sessions before delivery...');
  
  const currentSessions = await discoverSessions(false);
  
  // Compare with original session list
  const originalNames = new Set(originalSessions.map(s => s.name));
  const currentNames = new Set(currentSessions.map(s => s.name));
  
  const disappeared = originalSessions.filter(s => !currentNames.has(s.name));
  const appeared = currentSessions.filter(s => !originalNames.has(s.name));
  
  if (disappeared.length > 0) {
    console.log(`⚠️  ${disappeared.length} sessions ended since scheduling:`);
    if (verbose) {
      disappeared.forEach(s => console.log(`    - ${s.name}`));
    }
  }
  
  if (appeared.length > 0) {
    console.log(`✨ ${appeared.length} new sessions since scheduling:`);
    if (verbose) {
      appeared.forEach(s => console.log(`    + ${s.name}`));
    }
  }
  
  console.log(`📊 Sessions: ${originalSessions.length} → ${currentSessions.length}`);
  
  return currentSessions;
}
```

## Error Handling Strategy

### Error Categories & Responses
```javascript
const ERROR_STRATEGIES = {
  NO_SESSIONS: {
    code: 3,
    message: 'No tmux sessions found',
    action: 'exit',
    suggestion: 'Start some tmux sessions and try again'
  },
  
  SESSION_DISAPPEARED: {
    code: 0, // Not an error, continue with remaining
    message: 'Session ended before delivery',
    action: 'continue',
    suggestion: 'This is normal, continuing with remaining sessions'
  },
  
  DELIVERY_FAILED: {
    code: 0, // Not critical, report in summary
    message: 'Message delivery failed',
    action: 'continue',
    suggestion: 'Session may be unresponsive, check manually if needed'
  },
  
  ALL_DELIVERIES_FAILED: {
    code: 5,
    message: 'All message deliveries failed',
    action: 'exit',
    suggestion: 'Check tmux server status and session responsiveness'
  }
};
```

### Error Handling Implementation
```javascript
function handleDeliveryErrors(results, originalCount) {
  const { successful, failed } = results;
  
  // Summary reporting
  console.log(`📊 Delivery Results: ${successful}/${originalCount} successful`);
  
  if (failed > 0) {
    console.log(`⚠️  ${failed} deliveries failed`);
  }
  
  // Exit code determination
  if (successful === 0 && originalCount > 0) {
    console.log('❌ All deliveries failed');
    process.exit(ERROR_STRATEGIES.ALL_DELIVERIES_FAILED.code);
  }
  
  if (successful > 0) {
    console.log('✅ Scheduled continue completed successfully!');
    process.exit(0);
  }
}
```

## Integration Points

### Import Structure
```javascript
// Main script imports
import { TmuxInterface } from '../src/tmux_interface.js';
import { EnhancedTmuxInterface } from '../src/reliable_tmux_sender.js';

// Initialize once, reuse throughout script
const tmuxInterface = new TmuxInterface();
const enhancedTmux = new EnhancedTmuxInterface();
```

### Logging Integration
```javascript
// Follow send_enter_to_all.js emoji patterns
const EMOJIS = {
  DISCOVERY: '🔍',
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  SENDING: '📤',
  TARGET: '🎯',
  SUMMARY: '📊',
  INFO: '💡'
};
```

## Session Pattern Handling

### Current Pattern Recognition (Observed)
```javascript
// From tmux list-sessions output analysis:
// claude_exec_1749585348322
// claude_exec_1749585507602
// ... (100+ similar sessions)

function analyzeSessionPatterns(sessions, verbose = false) {
  const patterns = {
    claude_exec: sessions.filter(s => s.name.startsWith('claude_exec_')).length,
    claude_manager: sessions.filter(s => s.name.startsWith('claude_mgr_')).length,
    other: sessions.filter(s => !s.name.startsWith('claude_')).length
  };
  
  if (verbose) {
    console.log('📋 Session Pattern Analysis:');
    console.log(`  Claude Executives: ${patterns.claude_exec}`);
    console.log(`  Claude Managers: ${patterns.claude_manager}`);
    console.log(`  Other Sessions: ${patterns.other}`);
  }
  
  return patterns;
}
```

## Future Enhancement Hooks

### Session Filtering Options (Phase 2)
```javascript
// Command line: --pattern "claude_exec_*" --exclude "test_*"
function filterSessionsByPattern(sessions, include = null, exclude = null) {
  let filtered = sessions;
  
  if (include) {
    const regex = new RegExp(include.replace('*', '.*'));
    filtered = filtered.filter(s => regex.test(s.name));
  }
  
  if (exclude) {
    const regex = new RegExp(exclude.replace('*', '.*'));
    filtered = filtered.filter(s => !regex.test(s.name));
  }
  
  return filtered;
}
```

### Session Grouping (Phase 2)
```javascript
// Group sessions by type for different message strategies
function groupSessionsByType(sessions) {
  return {
    executives: sessions.filter(s => s.name.startsWith('claude_exec_')),
    managers: sessions.filter(s => s.name.startsWith('claude_mgr_')),
    specialists: sessions.filter(s => s.name.startsWith('claude_spec_')),
    other: sessions.filter(s => !s.name.startsWith('claude_'))
  };
}
```

## Integration Testing Strategy

### Mock Session Data
```javascript
const MOCK_SESSIONS = [
  { name: 'claude_exec_1749585348322', windows: 1, attached: false, id: 'claude_exec_1749585348322' },
  { name: 'claude_exec_1749585507602', windows: 1, attached: true, id: 'claude_exec_1749585507602' },
  { name: 'test_session', windows: 2, attached: false, id: 'test_session' }
];
```

### Integration Test Scenarios
1. **Normal operation**: 3 sessions, all succeed
2. **Some failures**: 3 sessions, 1 fails
3. **All failures**: 3 sessions, all fail
4. **Session disappearance**: Session dies between scheduling and execution
5. **No sessions**: Empty tmux server
6. **Pattern filtering**: Test include/exclude patterns

## Performance Considerations

### Memory Usage
- Session list is small (typically <200 sessions)
- Each session object is ~100 bytes
- Total memory impact: negligible

### Network/Process Overhead
- Each delivery creates a tmux subprocess
- With 100+ sessions: potential for process exhaustion
- Solution: Implement controlled concurrency (Phase 2)

### Timeout Handling
- EnhancedTmuxInterface has built-in timeouts
- Per-session timeout: ~5 seconds max
- Total delivery time: sessions × 5s (worst case)
- For 100 sessions: ~8 minutes maximum

## Conclusion

This integration strategy:
- ✅ Leverages existing robust components
- ✅ Provides excellent error handling
- ✅ Scales to 100+ sessions
- ✅ Maintains consistency with codebase patterns
- ✅ Allows for future enhancements