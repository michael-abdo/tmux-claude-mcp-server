# Time Format Specification for Scheduled Continue Feature

## Supported Time Formats

### 1. Absolute Time Formats

#### 24-Hour Format (HH:MM)
- **Format**: `15:30`, `09:45`, `23:59`
- **Rules**: Always interpreted as today if future, tomorrow if past today
- **Examples**: 
  - `15:30` → Today at 3:30 PM (if current time < 3:30 PM)
  - `09:00` → Tomorrow at 9:00 AM (if current time > 9:00 AM)

#### 12-Hour Format with AM/PM
- **Format**: `3:30pm`, `9:45am`, `11:59PM`
- **Rules**: Case-insensitive AM/PM, space optional
- **Examples**:
  - `3:30pm` → Today at 3:30 PM (if future) or tomorrow (if past)
  - `9 am` → Today at 9:00 AM (if future) or tomorrow (if past)
  - `12:30AM` → Midnight + 30 minutes

### 2. Relative Time Formats

#### Minute-based Relative
- **Format**: `+30m`, `+5m`, `+90m`
- **Rules**: Plus sign required, 'm' suffix required
- **Range**: 1-1440 minutes (1 minute to 24 hours)

#### Hour-based Relative  
- **Format**: `+2h`, `+1h`, `+12h`
- **Rules**: Plus sign required, 'h' suffix required
- **Range**: 1-24 hours
- **Conversion**: Fractional hours not supported (use minutes)

#### Combined Relative (Future Enhancement)
- **Format**: `+1h30m`, `+2h15m` 
- **Rules**: Hour component first, then minutes
- **Status**: Phase 2 implementation

### 3. Natural Language (Basic)

#### "In X minutes/hours"
- **Format**: `in 30 minutes`, `in 2 hours`, `in 1 hour`
- **Rules**: Case-insensitive, singular/plural supported
- **Examples**:
  - `in 30 minutes` → +30m
  - `in 1 hour` → +1h
  - `in 2 hours` → +2h

## Parsing Priority & Conflict Resolution

### Format Detection Order
1. **Relative formats** (`+30m`, `+2h`) - Most explicit
2. **12-hour with AM/PM** (`3:30pm`) - Unambiguous time
3. **24-hour format** (`15:30`) - Standard format
4. **Natural language** (`in 30 minutes`) - Most user-friendly

### Ambiguity Handling
- **No AM/PM specified**: Reject with error message
  - ❌ `2:30` → "Ambiguous time. Use 2:30am, 2:30pm, 14:30, or +Xm"
- **Past absolute time**: Schedule for tomorrow
  - ✅ `09:00` at 3:00 PM → Tomorrow 9:00 AM
- **Invalid time**: Reject with clear error
  - ❌ `25:30` → "Invalid hour. Use 0-23 for 24-hour format"

## Validation Rules

### Time Bounds
- **Minimum delay**: 1 minute (prevent immediate/accidental execution)
- **Maximum delay**: 24 hours (keep process manageable)
- **Invalid times**: 25:xx, xx:60, Feb 30th equivalent

### Input Sanitization
- **Whitespace**: Trim leading/trailing spaces
- **Case normalization**: Convert AM/PM to lowercase internally
- **Special characters**: Only allow +, :, alphanumeric

### Error Messages (User-Friendly)
```
Invalid Examples → Error Messages:
"2:30"        → "Ambiguous time. Specify 2:30am, 2:30pm, or 14:30"
"25:30"       → "Invalid hour (25). Use 0-23 for 24-hour format"
"3:70pm"      → "Invalid minutes (70). Use 0-59"
"+0m"         → "Minimum delay is 1 minute"
"+25h"        → "Maximum delay is 24 hours. Use +24h or absolute time"
"yesterday"   → "Only future times supported. Use +Xm, HH:MM, or H:MMam/pm"
```

## Implementation Strategy

### Parse Function Architecture
```javascript
function parseTimeInput(input) {
  // 1. Sanitize input
  // 2. Try relative format parsers
  // 3. Try absolute format parsers  
  // 4. Try natural language parsers
  // 5. Return {delayMs, targetTime, originalInput} or error
}
```

### Return Format
```javascript
{
  success: true,
  delayMs: 1800000,           // Milliseconds until execution
  targetTime: "2025-06-11T15:30:00.000Z",  // ISO timestamp
  originalInput: "+30m",       // What user typed
  parsedAs: "relative-minutes" // How it was interpreted
}
```

### Error Format
```javascript
{
  success: false,
  error: "Ambiguous time. Specify 2:30am, 2:30pm, or 14:30",
  suggestion: "Try: 14:30, 2:30pm, or +30m",
  originalInput: "2:30"
}
```

## Edge Cases & Special Handling

### Daylight Saving Time
- **Spring forward**: 2:30 AM may not exist → adjust to 3:30 AM
- **Fall back**: 2:30 AM occurs twice → use first occurrence
- **Solution**: Use UTC internally, convert for display

### System Clock Changes
- **Manual time changes**: Re-validate on execution
- **NTP adjustments**: Usually minimal impact
- **Timezone changes**: Use system timezone at parse time

### Process Interruption
- **System sleep**: setTimeout may pause → document limitation
- **Process termination**: No persistence → document limitation  
- **Long delays**: Recommend <4 hours for reliability

## Usage Examples

### Valid Inputs
```bash
node scripts/scheduled_continue.js "15:30"     # Today 3:30 PM
node scripts/scheduled_continue.js "3:30pm"   # Today 3:30 PM  
node scripts/scheduled_continue.js "+30m"     # In 30 minutes
node scripts/scheduled_continue.js "+2h"      # In 2 hours
node scripts/scheduled_continue.js "in 1 hour" # In 1 hour
```

### Error Examples
```bash
node scripts/scheduled_continue.js "2:30"     # Error: ambiguous
node scripts/scheduled_continue.js "25:30"    # Error: invalid hour
node scripts/scheduled_continue.js "+0m"      # Error: too soon
```

## Testing Strategy

### Unit Test Categories
1. **Valid formats**: All supported formats with known inputs/outputs
2. **Invalid formats**: All error conditions with expected messages
3. **Edge cases**: DST transitions, midnight, leap years
4. **Boundary conditions**: Min/max delays, extreme times

### Test Data Sets
- **Valid absolute times**: Cover all hours, edge times (midnight, noon)
- **Valid relative times**: 1m to 24h range
- **Invalid inputs**: Malformed, out-of-range, ambiguous
- **Edge cases**: DST transitions, year boundaries

## Future Enhancements (Phase 2)

### Advanced Relative Formats
- `+1h30m` (combined hours and minutes)
- `+90s` (seconds-based for testing)

### Date-Specific Absolute Times
- `tomorrow 9am` (explicit date specification)
- `june 15 3pm` (specific date)

### Recurring Schedules
- `every 30m` (repeating schedules)
- `daily 9am` (daily recurring)

### Natural Language Expansion  
- `in half an hour` → +30m
- `at quarter past 3` → 15:15
- `noon tomorrow` → next day 12:00

## Implementation Priority

### Phase 1 (MVP)
1. ✅ Relative formats (`+30m`, `+2h`)
2. ✅ 24-hour absolute (`15:30`)
3. ✅ 12-hour with AM/PM (`3:30pm`)
4. ✅ Basic natural language (`in X minutes/hours`)

### Phase 2 (Enhanced)
1. Combined relative formats (`+1h30m`)
2. Better error messages with suggestions
3. DST handling improvements
4. Expanded natural language

### Phase 3 (Advanced)
1. Date-specific times
2. Recurring schedules
3. Timezone awareness
4. Full natural language processing