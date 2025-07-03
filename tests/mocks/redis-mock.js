/**
 * Simple Redis mock for testing
 * Provides in-memory implementation of Redis commands used by our application
 */

export class RedisMock {
  constructor() {
    this.data = new Map();
    this.expiry = new Map();
    this.connected = false;
  }

  // Connection methods
  async connect() {
    this.connected = true;
    return this;
  }

  async quit() {
    this.connected = false;
    return 'OK';
  }

  async disconnect() {
    this.connected = false;
    return 'OK';
  }

  // Basic operations
  async get(key) {
    this._checkExpiry(key);
    const value = this.data.get(key);
    return value || null;
  }

  async set(key, value, options = {}) {
    this.data.set(key, value);
    
    if (options.EX) {
      const expiryTime = Date.now() + (options.EX * 1000);
      this.expiry.set(key, expiryTime);
    }
    
    return 'OK';
  }

  async setEx(key, seconds, value) {
    return this.set(key, value, { EX: seconds });
  }

  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        this.expiry.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys) {
    let count = 0;
    for (const key of keys) {
      this._checkExpiry(key);
      if (this.data.has(key)) count++;
    }
    return count;
  }

  // Hash operations
  async hSet(key, field, value) {
    let hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') {
      hash = {};
    }
    hash[field] = value;
    this.data.set(key, hash);
    return 1;
  }

  async hGet(key, field) {
    const hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') return null;
    return hash[field] || null;
  }

  async hGetAll(key) {
    const hash = this.data.get(key);
    if (!hash || typeof hash !== 'object') return {};
    return { ...hash };
  }

  // List operations
  async lPush(key, ...values) {
    let list = this.data.get(key);
    if (!Array.isArray(list)) {
      list = [];
    }
    list.unshift(...values.reverse());
    this.data.set(key, list);
    return list.length;
  }

  async rPush(key, ...values) {
    let list = this.data.get(key);
    if (!Array.isArray(list)) {
      list = [];
    }
    list.push(...values);
    this.data.set(key, list);
    return list.length;
  }

  async lRange(key, start, stop) {
    const list = this.data.get(key);
    if (!Array.isArray(list)) return [];
    
    // Handle negative indices
    if (stop === -1) stop = list.length - 1;
    if (start < 0) start = list.length + start;
    if (stop < 0) stop = list.length + stop;
    
    return list.slice(start, stop + 1);
  }

  // Pattern matching
  async keys(pattern) {
    const regex = this._patternToRegex(pattern);
    const matches = [];
    
    for (const key of this.data.keys()) {
      this._checkExpiry(key);
      if (regex.test(key) && this.data.has(key)) {
        matches.push(key);
      }
    }
    
    return matches;
  }

  // Utility methods
  async flushAll() {
    this.data.clear();
    this.expiry.clear();
    return 'OK';
  }

  async ping() {
    return 'PONG';
  }

  // Helper methods
  _checkExpiry(key) {
    const expiryTime = this.expiry.get(key);
    if (expiryTime && Date.now() > expiryTime) {
      this.data.delete(key);
      this.expiry.delete(key);
    }
  }

  _patternToRegex(pattern) {
    // Convert Redis pattern to JavaScript regex
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}

// Factory function to create Redis mock client
export function createClient() {
  const mock = new RedisMock();
  
  // Auto-connect on creation (mimics redis behavior with lazy connection)
  setImmediate(() => {
    mock.connected = true;
  });
  
  return mock;
}

// Export both for flexibility
export default {
  createClient,
  RedisMock
};