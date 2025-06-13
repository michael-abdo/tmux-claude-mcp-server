/**
 * Time Parser Utility for Scheduled Continue Feature
 * 
 * Supports multiple time formats:
 * - Relative: +30m, +2h
 * - 24-hour: 15:30, 09:45
 * - 12-hour: 3:30pm, 9:45am
 * - Natural language: "in 30 minutes", "in 2 hours"
 */

/**
 * Parse time input and return delay information
 * @param {string} input - Time specification from user
 * @returns {Object} Result object with success, delayMs, targetTime, etc.
 */
export function parseTimeInput(input) {
  if (!input || typeof input !== 'string') {
    return {
      success: false,
      error: 'Time input is required',
      suggestion: 'Try: +30m, 15:30, 3:30pm, or "in 2 hours"',
      originalInput: input
    };
  }

  const sanitized = input.trim();
  
  // Try each parser in priority order
  const parsers = [
    parseRelativeFormat,
    parse12HourFormat,
    parse24HourFormat,
    parseNaturalLanguage
  ];

  for (const parser of parsers) {
    const result = parser(sanitized);
    if (result.success) {
      return result;
    }
  }

  // No parser succeeded
  return {
    success: false,
    error: `Invalid time format: "${sanitized}"`,
    suggestion: 'Valid formats: +30m, +2h, 15:30, 3:30pm, "in 30 minutes"',
    originalInput: input
  };
}

/**
 * Parse relative time formats like +30m, +2h
 */
function parseRelativeFormat(input) {
  const relativeRegex = /^\+(\d+)([mh])$/i;
  const match = input.match(relativeRegex);
  
  if (!match) {
    return { success: false };
  }

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);
  
  // Validate ranges
  if (unit.toLowerCase() === 'm') {
    if (value < 1 || value > 1440) {
      return {
        success: false,
        error: `Minutes must be between 1 and 1440 (24 hours), got ${value}`,
        originalInput: input
      };
    }
    const delayMs = value * 60 * 1000;
    return createSuccessResult(delayMs, input, 'relative-minutes');
  } else if (unit.toLowerCase() === 'h') {
    if (value < 1 || value > 24) {
      return {
        success: false,
        error: `Hours must be between 1 and 24, got ${value}`,
        originalInput: input
      };
    }
    const delayMs = value * 60 * 60 * 1000;
    return createSuccessResult(delayMs, input, 'relative-hours');
  }

  return { success: false };
}

/**
 * Parse 12-hour format with AM/PM
 */
function parse12HourFormat(input) {
  // Match various 12-hour formats: 3:30pm, 3:30 pm, 3:30PM, 3pm, 3 PM
  const regex12Hour = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i;
  const match = input.match(regex12Hour);
  
  if (!match) {
    return { success: false };
  }

  const [, hourStr, minuteStr = '00', ampm] = match;
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  // Validate hour and minute
  if (hour < 1 || hour > 12) {
    return {
      success: false,
      error: `Invalid hour (${hour}) for 12-hour format. Use 1-12`,
      originalInput: input
    };
  }
  
  if (minute < 0 || minute > 59) {
    return {
      success: false,
      error: `Invalid minutes (${minute}). Use 0-59`,
      originalInput: input
    };
  }

  // Convert to 24-hour format
  if (ampm.toLowerCase() === 'pm' && hour !== 12) {
    hour += 12;
  } else if (ampm.toLowerCase() === 'am' && hour === 12) {
    hour = 0;
  }

  return calculateDelayFromAbsoluteTime(hour, minute, input, '12-hour');
}

/**
 * Parse 24-hour format
 */
function parse24HourFormat(input) {
  const regex24Hour = /^(\d{1,2}):(\d{2})$/;
  const match = input.match(regex24Hour);
  
  if (!match) {
    return { success: false };
  }

  const [, hourStr, minuteStr] = match;
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  
  // Validate hour and minute
  if (hour < 0 || hour > 23) {
    return {
      success: false,
      error: `Invalid hour (${hour}). Use 0-23 for 24-hour format`,
      originalInput: input
    };
  }
  
  if (minute < 0 || minute > 59) {
    return {
      success: false,
      error: `Invalid minutes (${minute}). Use 0-59`,
      originalInput: input
    };
  }

  // Check for ambiguous times (could be AM or PM)
  if (hour > 0 && hour <= 12) {
    return {
      success: false,
      error: `Ambiguous time. Specify ${hour}:${minuteStr.padStart(2, '0')}am, ${hour}:${minuteStr.padStart(2, '0')}pm, or ${hour.toString().padStart(2, '0')}:${minuteStr}`,
      suggestion: `Try: ${hour}:${minuteStr}am, ${hour}:${minuteStr}pm, or +Xm for relative time`,
      originalInput: input
    };
  }

  return calculateDelayFromAbsoluteTime(hour, minute, input, '24-hour');
}

/**
 * Parse natural language formats
 */
function parseNaturalLanguage(input) {
  const lowerInput = input.toLowerCase();
  
  // Match "in X minutes" or "in X minute"
  const minutesMatch = lowerInput.match(/^in\s+(\d+)\s+minutes?$/);
  if (minutesMatch) {
    const minutes = parseInt(minutesMatch[1], 10);
    if (minutes < 1 || minutes > 1440) {
      return {
        success: false,
        error: `Minutes must be between 1 and 1440 (24 hours), got ${minutes}`,
        originalInput: input
      };
    }
    const delayMs = minutes * 60 * 1000;
    return createSuccessResult(delayMs, input, 'natural-minutes');
  }
  
  // Match "in X hours" or "in X hour"
  const hoursMatch = lowerInput.match(/^in\s+(\d+)\s+hours?$/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    if (hours < 1 || hours > 24) {
      return {
        success: false,
        error: `Hours must be between 1 and 24, got ${hours}`,
        originalInput: input
      };
    }
    const delayMs = hours * 60 * 60 * 1000;
    return createSuccessResult(delayMs, input, 'natural-hours');
  }

  return { success: false };
}

/**
 * Calculate delay from absolute time (handles today/tomorrow logic)
 */
function calculateDelayFromAbsoluteTime(hour, minute, originalInput, parsedAs) {
  const now = new Date();
  const target = new Date();
  
  // Set target time
  target.setHours(hour, minute, 0, 0);
  
  // If target time is in the past today, schedule for tomorrow
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }
  
  const delayMs = target.getTime() - now.getTime();
  
  // Validate delay is within bounds (1 minute to 24 hours)
  if (delayMs < 60000) {
    return {
      success: false,
      error: 'Minimum delay is 1 minute',
      suggestion: 'Use a time at least 1 minute in the future',
      originalInput
    };
  }
  
  if (delayMs > 24 * 60 * 60 * 1000) {
    return {
      success: false,
      error: 'Maximum delay is 24 hours',
      suggestion: 'Use a time within the next 24 hours',
      originalInput
    };
  }
  
  return {
    success: true,
    delayMs,
    targetTime: target.toISOString(),
    originalInput,
    parsedAs,
    scheduledForTomorrow: target.getDate() !== now.getDate()
  };
}

/**
 * Create a success result object
 */
function createSuccessResult(delayMs, originalInput, parsedAs) {
  const targetTime = new Date(Date.now() + delayMs);
  
  return {
    success: true,
    delayMs,
    targetTime: targetTime.toISOString(),
    originalInput,
    parsedAs
  };
}

/**
 * Utility function to get current time
 */
export function getCurrentTime() {
  return new Date();
}

/**
 * Check if a given time is in the future
 */
export function isValidFutureTime(date) {
  return date instanceof Date && date > new Date();
}

/**
 * Format time for logging output
 */
export function formatTimeForLogging(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Calculate delay in milliseconds from now to target time
 */
export function calculateDelayMs(targetTime) {
  const target = targetTime instanceof Date ? targetTime : new Date(targetTime);
  const now = new Date();
  return Math.max(0, target.getTime() - now.getTime());
}

/**
 * Format delay for human-readable display
 */
export function formatDelay(delayMs) {
  const totalSeconds = Math.floor(delayMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);
  
  return parts.join(', ') || '0 seconds';
}

/**
 * Validate time bounds (1 minute to 24 hours)
 */
export function validateTimeBounds(delayMs) {
  const MIN_DELAY = 60 * 1000; // 1 minute
  const MAX_DELAY = 24 * 60 * 60 * 1000; // 24 hours
  
  if (delayMs < MIN_DELAY) {
    return {
      valid: false,
      error: 'Minimum delay is 1 minute',
      suggestion: 'Use a time at least 1 minute in the future'
    };
  }
  
  if (delayMs > MAX_DELAY) {
    return {
      valid: false,
      error: 'Maximum delay is 24 hours',
      suggestion: 'Use a time within the next 24 hours'
    };
  }
  
  return { valid: true };
}

// Export all functions for testing
export default {
  parseTimeInput,
  getCurrentTime,
  isValidFutureTime,
  formatTimeForLogging,
  calculateDelayMs,
  formatDelay,
  validateTimeBounds
};