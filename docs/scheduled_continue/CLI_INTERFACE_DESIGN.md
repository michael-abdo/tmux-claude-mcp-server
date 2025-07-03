# Command-Line Interface Design

## Basic Usage Pattern

```bash
node scripts/scheduled_continue.js <time> [options]
```

## Arguments Structure

### Required Arguments
- **`<time>`**: Time specification (first positional argument)
  - Supports all formats from TIME_FORMAT_SPECIFICATION.md
  - Examples: `"+30m"`, `"15:30"`, `"3:30pm"`, `"in 2 hours"`

### Optional Flags

#### Message Customization
- **`--message <text>`** or **`-m <text>`**
  - Custom message to send (default: "Plz continue")
  - Example: `--message "Time to check progress"`

#### Execution Control
- **`--dry-run`** or **`-n`**
  - Show what would happen without executing
  - Lists target time, sessions found, message to send
  - No actual scheduling or message delivery

- **`--verbose`** or **`-v`**
  - Detailed logging throughout execution
  - Shows session discovery details, parsing details, scheduling details

#### Help & Information
- **`--help`** or **`-h`**
  - Display comprehensive help text with examples
  - Exit with code 0

- **`--version`** or **`-V`**
  - Display script version information
  - Exit with code 0

## Usage Examples

### Basic Usage
```bash
# Schedule in 30 minutes
node scripts/scheduled_continue.js "+30m"

# Schedule at 3:30 PM today
node scripts/scheduled_continue.js "15:30"

# Schedule at 2:30 PM with AM/PM format
node scripts/scheduled_continue.js "2:30pm"

# Schedule in 2 hours using natural language
node scripts/scheduled_continue.js "in 2 hours"
```

### Advanced Usage
```bash
# Custom message
node scripts/scheduled_continue.js "+1h" --message "Time for code review"

# Test what would happen (dry run)
node scripts/scheduled_continue.js "+5m" --dry-run

# Verbose logging for debugging
node scripts/scheduled_continue.js "+10m" --verbose

# Combined flags
node scripts/scheduled_continue.js "+30m" -m "Standup reminder" -v
```

### Help and Information
```bash
# Show help
node scripts/scheduled_continue.js --help

# Show version
node scripts/scheduled_continue.js --version
```

## Help Text Design

```
Scheduled Continue - Send "Plz continue" to all tmux sessions at a specified time

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
  Time formats: ./TIME_FORMAT_SPECIFICATION.md
  Scheduling: ./SCHEDULING_MECHANISM_ANALYSIS.md
```

## Argument Parsing Strategy

### Implementation Plan
```javascript
import { parseArgs } from 'node:util';

function parseCommandLine() {
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
    version: values.version || false
  };
}
```

### Validation Rules
1. **Time argument required**: Must have exactly one positional argument
2. **Message validation**: Non-empty string, reasonable length (<500 chars)
3. **Flag validation**: Boolean flags don't need values
4. **Mutually exclusive**: --help and --version exit immediately

## Error Handling Design

### Missing Time Argument
```bash
$ node scripts/scheduled_continue.js
❌ Error: Time argument required

Usage: node scripts/scheduled_continue.js <time> [options]
Try: node scripts/scheduled_continue.js --help
```

### Invalid Time Format
```bash
$ node scripts/scheduled_continue.js "25:30"
❌ Error: Invalid hour (25). Use 0-23 for 24-hour format

Valid examples:
  +30m          (in 30 minutes)
  15:30         (3:30 PM today)
  3:30pm        (3:30 PM today)
  "in 2 hours"  (in 2 hours)

Try: node scripts/scheduled_continue.js --help
```

### Too Many Arguments
```bash
$ node scripts/scheduled_continue.js "+30m" "extra"
❌ Error: Too many arguments. Expected only one time specification.

Usage: node scripts/scheduled_continue.js <time> [options]
Try: node scripts/scheduled_continue.js --help
```

### Invalid Message
```bash
$ node scripts/scheduled_continue.js "+30m" --message ""
❌ Error: Message cannot be empty

Try: node scripts/scheduled_continue.js "+30m" -m "Your message here"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (scheduled and executed successfully) |
| 1 | General error (invalid arguments, parsing failed) |
| 2 | Time parsing error (invalid time format) |
| 3 | Session discovery error (no tmux sessions found) |
| 4 | Scheduling error (unable to schedule) |
| 5 | Execution error (scheduling succeeded but delivery failed) |

## User Experience Enhancements

### Immediate Feedback
```bash
$ node scripts/scheduled_continue.js "+30m"
⏰ Parsing time input: "+30m"
✅ Parsed as: 30 minutes from now
📅 Target time: 2025-06-11 14:30:15
🔍 Discovering tmux sessions...
✅ Found 127 active tmux sessions
📝 Message to send: "Plz continue"
⚠️  IMPORTANT: Keep this process running until 14:30:15
🔄 Scheduling execution in 30 minutes...
```

### Progress Updates (Every 10 minutes for delays >30 minutes)
```bash
⏰ 20 minutes remaining until execution (target: 14:30:15)
⏰ 10 minutes remaining until execution (target: 14:30:15)
⏰ 1 minute remaining until execution (target: 14:30:15)
```

### Execution Confirmation
```bash
⚡ Executing scheduled task at 14:30:15
🔍 Re-validating tmux sessions...
✅ Found 125 active sessions (2 sessions ended since scheduling)
📤 Sending message to 125 sessions...
  ✓ Sent to claude_exec_1749585348322
  ✓ Sent to claude_exec_1749585507602
  ...
📊 Results: 123/125 successful, 2 failed
✅ Scheduled continue completed successfully!
```

### Dry Run Output
```bash
$ node scripts/scheduled_continue.js "+30m" --dry-run
🧪 DRY RUN MODE - No actual scheduling or execution

⏰ Time input: "+30m"
✅ Parsed as: 30 minutes from now
📅 Target time: 2025-06-11 14:30:15
⏳ Delay: 1800000 milliseconds (30 minutes)

🔍 Discovering tmux sessions...
✅ Found 127 active tmux sessions:
  - claude_exec_1749585348322
  - claude_exec_1749585507602
  - ... (125 more)

📝 Message to send: "Plz continue"

🧪 In real execution:
  1. Process would remain active for 30 minutes
  2. At 14:30:15, would send message to all sessions
  3. Would use high-reliability delivery strategy

✅ Dry run completed - everything looks good!
```

## Integration with Existing Patterns

### Emoji Usage (following send_enter_to_all.js pattern)
- 🔍 for discovery
- ⏰ for time-related actions
- 📅 for dates/scheduling
- 📤 for sending
- ✅/❌ for success/failure
- ⚠️ for warnings
- 🔄 for ongoing processes

### Error Format (following existing patterns)
- Start with ❌ emoji
- Clear, actionable error messages
- Suggest next steps or alternatives
- Reference help command

### Console Output Structure
- Status updates with clear icons
- Important warnings highlighted
- Summary information at key points
- Progress indicators for long operations

## Command Alias Considerations

### Short Script Name (future enhancement)
```bash
# Could add to package.json scripts:
npm run schedule "+30m"
npm run schedule "15:30" -- --message "Review time"

# Or global install:
tmux-schedule "+30m"
```

### Shell Alias Suggestions (for users)
```bash
# Add to ~/.bashrc or ~/.zshrc
alias schedule='node /path/to/scripts/scheduled_continue.js'
alias sched='node /path/to/scripts/scheduled_continue.js'

# Usage becomes:
schedule "+30m"
sched "15:30" -m "Check progress"
```