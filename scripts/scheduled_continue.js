#!/usr/bin/env node

/**
 * Scheduled Continue - Send "Plz continue" to all tmux sessions at a specified time
 * 
 * Usage:
 *   node scripts/scheduled_continue.js <time> [options]
 * 
 * Time formats:
 *   +30m, +2h           - Relative time
 *   15:30, 09:45        - 24-hour format  
 *   3:30pm, 9:45am      - 12-hour format
 *   "in 30 minutes"     - Natural language
 */

import { parseArgs } from 'node:util';
import { TmuxInterface } from '../src/tmux_interface.js';
import { EnhancedTmuxInterface } from '../src/reliable_tmux_sender.js';
import { 
  parseTimeInput, 
  formatTimeForLogging, 
  formatDelay,
  validateTimeBounds 
} from './utils/time_parser.js';

// Version information
const VERSION = '1.0.0';

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  TIME_PARSE_ERROR: 2,
  NO_SESSIONS: 3,
  SCHEDULING_ERROR: 4,
  EXECUTION_ERROR: 5
};

/**
 * Parse command line arguments
 */
function parseCommandLine() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        message: { type: 'string', short: 'm' },
        'dry-run': { type: 'boolean', short: 'n' },
        verbose: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'V' }
      },
      allowPositionals: true
    });

    return {
      timeInput: positionals[0],
      message: values.message || 'Plz continue',
      dryRun: values['dry-run'] || false,
      verbose: values.verbose || false,
      help: values.help || false,
      version: values.version || false,
      extraArgs: positionals.slice(1)
    };
  } catch (error) {
    console.error(`❌ Error parsing arguments: ${error.message}`);
    console.error('Try: node scripts/scheduled_continue.js --help');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

/**
 * Display help text
 */
function showHelp() {
  console.log(`Scheduled Continue - Send "Plz continue" to all tmux sessions at a specified time

USAGE:
  node scripts/scheduled_continue.js <time> [options]

TIME FORMATS:
  Relative:     +30m, +2h, +90m
  24-hour:      15:30, 09:45, 23:59
  12-hour:      3:30pm, 9:45am, 11:59PM
  Natural:      "in 30 minutes", "in 2 hours"

OPTIONS:
  -m, --message <text>    Custom message to send (default: "Plz continue")
  -n, --dry-run          Show what would happen without executing
  -v, --verbose          Enable detailed logging
  -h, --help             Show this help message
  -V, --version          Show version information

EXAMPLES:
  node scripts/scheduled_continue.js "+30m"
    Schedule "Plz continue" in 30 minutes

  node scripts/scheduled_continue.js "15:30"
    Schedule "Plz continue" at 3:30 PM today

  node scripts/scheduled_continue.js "+1h" -m "Time to review"
    Schedule custom message in 1 hour

  node scripts/scheduled_continue.js "+5m" --dry-run
    Test scheduling without actually executing

IMPORTANT NOTES:
  ⚠️  This process must remain running until execution time
  ⚠️  System sleep/hibernate may interrupt scheduling
  ⚠️  Maximum scheduling window: 24 hours
  ⚠️  Use Ctrl+C to cancel before execution

MORE INFO:
  Time formats: ../docs/scheduled_continue/TIME_FORMAT_SPECIFICATION.md
  Scheduling: ../docs/scheduled_continue/SCHEDULING_MECHANISM_ANALYSIS.md`);
}

/**
 * Display version information
 */
function showVersion() {
  console.log(`scheduled_continue v${VERSION}`);
}

/**
 * Discover active tmux sessions
 */
async function discoverSessions(verbose = false) {
  if (verbose) console.log('🔍 Discovering tmux sessions...');
  
  const tmuxInterface = new TmuxInterface();
  const sessions = await tmuxInterface.listSessions();
  
  if (sessions.length === 0) {
    console.log('❌ No active tmux sessions found');
    console.log('💡 Start some tmux sessions and try again');
    return null;
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

/**
 * Re-validate sessions at execution time
 */
async function revalidateSessionsAtExecution(originalSessions, verbose = false) {
  if (verbose) console.log('🔍 Re-validating tmux sessions before delivery...');
  
  const currentSessions = await discoverSessions(false);
  if (!currentSessions) return null;
  
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

/**
 * Deliver message to all sessions
 */
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

/**
 * Schedule execution with setTimeout
 */
function scheduleExecution(delayMs, callback, options = {}) {
  const { verbose = false } = options;
  
  console.log(`⏰ Scheduling execution in ${formatDelay(delayMs)}`);
  console.log(`📅 Target time: ${formatTimeForLogging(new Date(Date.now() + delayMs))}`);
  console.log(`🔄 Process will remain active until execution...`);
  console.log(`⚠️  IMPORTANT: Keep this process running until execution time`);
  console.log(`⚠️  Use Ctrl+C to cancel\n`);
  
  // Show progress updates for long delays
  let progressInterval = null;
  if (delayMs > 30 * 60 * 1000) { // > 30 minutes
    progressInterval = setInterval(() => {
      const remaining = Math.max(0, delayMs - (Date.now() - startTime));
      if (remaining > 0) {
        console.log(`⏰ ${formatDelay(remaining)} remaining until execution`);
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }
  
  const startTime = Date.now();
  const timeoutId = setTimeout(async () => {
    if (progressInterval) clearInterval(progressInterval);
    console.log(`⚡ Executing scheduled task at ${formatTimeForLogging(new Date())}`);
    await callback();
  }, delayMs);
  
  // Handle graceful shutdown
  setupSignalHandlers(timeoutId, progressInterval);
  
  return timeoutId;
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(timeoutId, progressInterval) {
  const cleanup = () => {
    console.log('\n⚠️  Cancelling scheduled execution...');
    clearTimeout(timeoutId);
    if (progressInterval) clearInterval(progressInterval);
    console.log('✅ Scheduled execution cancelled');
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

/**
 * Main execution flow
 */
async function main() {
  const args = parseCommandLine();
  
  // Handle help and version flags
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  if (args.version) {
    showVersion();
    process.exit(0);
  }
  
  // Validate arguments
  if (!args.timeInput) {
    console.error('❌ Error: Time argument required\n');
    console.error('Usage: node scripts/scheduled_continue.js <time> [options]');
    console.error('Try: node scripts/scheduled_continue.js --help');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
  
  if (args.extraArgs.length > 0) {
    console.error('❌ Error: Too many arguments. Expected only one time specification.\n');
    console.error('Usage: node scripts/scheduled_continue.js <time> [options]');
    console.error('Try: node scripts/scheduled_continue.js --help');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
  
  if (args.message.trim() === '') {
    console.error('❌ Error: Message cannot be empty\n');
    console.error('Try: node scripts/scheduled_continue.js "+30m" -m "Your message here"');
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
  
  // Parse time input
  console.log(`⏰ Parsing time input: "${args.timeInput}"`);
  const parseResult = parseTimeInput(args.timeInput);
  
  if (!parseResult.success) {
    console.error(`❌ Error: ${parseResult.error}\n`);
    if (parseResult.suggestion) {
      console.error(parseResult.suggestion);
    }
    console.error('\nValid examples:');
    console.error('  +30m          (in 30 minutes)');
    console.error('  15:30         (3:30 PM today)');
    console.error('  3:30pm        (3:30 PM today)');
    console.error('  "in 2 hours"  (in 2 hours)\n');
    console.error('Try: node scripts/scheduled_continue.js --help');
    process.exit(EXIT_CODES.TIME_PARSE_ERROR);
  }
  
  console.log(`✅ Parsed as: ${formatDelay(parseResult.delayMs)} from now`);
  console.log(`📅 Target time: ${formatTimeForLogging(parseResult.targetTime)}`);
  if (parseResult.scheduledForTomorrow) {
    console.log(`📅 Note: Scheduled for tomorrow (time has already passed today)`);
  }
  
  // Discover sessions
  const sessions = await discoverSessions(args.verbose);
  if (!sessions) {
    process.exit(EXIT_CODES.NO_SESSIONS);
  }
  
  console.log(`📝 Message to send: "${args.message}"`);
  
  // Dry run mode
  if (args.dryRun) {
    console.log('\n🧪 DRY RUN MODE - No actual scheduling or execution\n');
    console.log('🧪 In real execution:');
    console.log(`  1. Process would remain active for ${formatDelay(parseResult.delayMs)}`);
    console.log(`  2. At ${formatTimeForLogging(parseResult.targetTime)}, would send message to all sessions`);
    console.log('  3. Would use high-reliability delivery strategy\n');
    console.log('✅ Dry run completed - everything looks good!');
    process.exit(0);
  }
  
  // Schedule execution
  scheduleExecution(parseResult.delayMs, async () => {
    // Re-validate sessions at execution time
    const currentSessions = await revalidateSessionsAtExecution(sessions, args.verbose);
    if (!currentSessions) {
      console.log('❌ No sessions available at execution time');
      process.exit(EXIT_CODES.EXECUTION_ERROR);
    }
    
    // Deliver messages
    const results = await deliverToAllSessions(currentSessions, args.message, {
      verbose: args.verbose,
      dryRun: false
    });
    
    // Report results
    console.log(`\n📊 Results: ${results.successful}/${currentSessions.length} successful`);
    
    if (results.failed > 0) {
      console.log(`⚠️  ${results.failed} deliveries failed`);
    }
    
    if (results.successful === 0 && currentSessions.length > 0) {
      console.log('❌ All deliveries failed');
      process.exit(EXIT_CODES.EXECUTION_ERROR);
    }
    
    console.log('✅ Scheduled continue completed successfully!');
    process.exit(EXIT_CODES.SUCCESS);
  }, { verbose: args.verbose });
}

// Run the script
main().catch(error => {
  console.error(`❌ Unexpected error: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(EXIT_CODES.GENERAL_ERROR);
});