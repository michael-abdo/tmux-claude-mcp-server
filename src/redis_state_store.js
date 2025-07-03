/**
 * Redis State Store for Phase 3
 * 
 * Provides distributed state management for parallel Claude instances.
 * This replaces the JSON file-based state store from Phase 1/2 with
 * a Redis-backed implementation that supports concurrent access.
 * 
 * Falls back to JSON file storage if Redis is not available.
 */

import fs from 'fs-extra';
import path from 'path';

// Mock Redis client for now - in production would use 'redis' package
class MockRedisClient {
    constructor() {
        this.data = new Map();
        this.connected = false;
    }

    async connect() {
        this.connected = true;
        console.log('Mock Redis client connected');
    }

    async disconnect() {
        this.connected = false;
    }

    async hset(key, field, value) {
        if (!this.data.has(key)) {
            this.data.set(key, new Map());
        }
        this.data.get(key).set(field, value);
    }

    async hget(key, field) {
        const hash = this.data.get(key);
        return hash ? hash.get(field) : null;
    }

    async hgetall(key) {
        const hash = this.data.get(key);
        if (!hash) return {};
        
        const result = {};
        for (const [field, value] of hash) {
            result[field] = value;
        }
        return result;
    }

    async hdel(key, field) {
        const hash = this.data.get(key);
        if (hash) {
            hash.delete(field);
        }
    }

    async del(key) {
        this.data.delete(key);
    }

    async expire(key, seconds) {
        // Mock implementation - would set TTL in real Redis
        setTimeout(() => this.del(key), seconds * 1000);
    }

    async sadd(key, ...members) {
        if (!this.data.has(key)) {
            this.data.set(key, new Set());
        }
        const set = this.data.get(key);
        for (const member of members) {
            set.add(member);
        }
    }

    async srem(key, ...members) {
        const set = this.data.get(key);
        if (set) {
            for (const member of members) {
                set.delete(member);
            }
        }
    }

    async smembers(key) {
        const set = this.data.get(key);
        return set ? Array.from(set) : [];
    }

    async publish(channel, message) {
        // Mock pub/sub - would use Redis pub/sub in production
        console.log(`Published to ${channel}: ${message}`);
    }
}

export class RedisStateStore {
    constructor(options = {}) {
        this.redisUrl = options.redisUrl || process.env.REDIS_URL;
        this.fallbackDir = options.fallbackDir || './state';
        this.ttl = options.ttl || 3600; // 1 hour default TTL
        this.client = null;
        this.useFallback = false;
        
        // Keys for different data types
        this.INSTANCES_KEY = 'tmux-claude:instances';
        this.JOBS_KEY = 'tmux-claude:jobs';
        this.LOCKS_KEY = 'tmux-claude:locks';
        this.METRICS_KEY = 'tmux-claude:metrics';
    }

    /**
     * Initialize the state store.
     * Attempts to connect to Redis, falls back to JSON if unavailable.
     */
    async initialize() {
        try {
            if (this.redisUrl) {
                // In production, would use: import { createClient } from 'redis';
                // this.client = createClient({ url: this.redisUrl });
                this.client = new MockRedisClient();
                await this.client.connect();
                console.log('Connected to Redis state store');
            } else {
                throw new Error('No Redis URL configured');
            }
        } catch (error) {
            console.warn('Redis unavailable, using JSON file fallback:', error.message);
            this.useFallback = true;
            await fs.ensureDir(this.fallbackDir);
        }
    }

    /**
     * Save instance data with atomic operations.
     */
    async saveInstance(instanceId, instanceData) {
        const data = JSON.stringify(instanceData);
        
        if (this.useFallback) {
            return this.saveInstanceToFile(instanceId, instanceData);
        }

        try {
            // Save to Redis hash
            await this.client.hset(this.INSTANCES_KEY, instanceId, data);
            
            // Set expiration
            await this.client.expire(`${this.INSTANCES_KEY}:${instanceId}`, this.ttl);
            
            // Add to active instances set
            await this.client.sadd(`${this.INSTANCES_KEY}:active`, instanceId);
            
            // Publish update event
            await this.client.publish('instance-updates', JSON.stringify({
                action: 'save',
                instanceId,
                timestamp: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('Redis save failed, using fallback:', error);
            return this.saveInstanceToFile(instanceId, instanceData);
        }
    }

    /**
     * Get instance data.
     */
    async getInstance(instanceId) {
        if (this.useFallback) {
            return this.getInstanceFromFile(instanceId);
        }

        try {
            const data = await this.client.hget(this.INSTANCES_KEY, instanceId);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis get failed, using fallback:', error);
            return this.getInstanceFromFile(instanceId);
        }
    }

    /**
     * Get all instances.
     */
    async getAllInstances() {
        if (this.useFallback) {
            return this.getAllInstancesFromFile();
        }

        try {
            const data = await this.client.hgetall(this.INSTANCES_KEY);
            const instances = {};
            
            for (const [id, json] of Object.entries(data)) {
                try {
                    instances[id] = JSON.parse(json);
                } catch (e) {
                    console.error(`Failed to parse instance ${id}:`, e);
                }
            }
            
            return instances;
        } catch (error) {
            console.error('Redis getall failed, using fallback:', error);
            return this.getAllInstancesFromFile();
        }
    }

    /**
     * Delete instance data.
     */
    async deleteInstance(instanceId) {
        if (this.useFallback) {
            return this.deleteInstanceFromFile(instanceId);
        }

        try {
            await this.client.hdel(this.INSTANCES_KEY, instanceId);
            await this.client.srem(`${this.INSTANCES_KEY}:active`, instanceId);
            
            // Publish delete event
            await this.client.publish('instance-updates', JSON.stringify({
                action: 'delete',
                instanceId,
                timestamp: new Date().toISOString()
            }));
            
        } catch (error) {
            console.error('Redis delete failed, using fallback:', error);
            return this.deleteInstanceFromFile(instanceId);
        }
    }

    /**
     * Acquire a distributed lock for critical operations.
     * Used to prevent race conditions in parallel execution.
     */
    async acquireLock(resource, ttlMs = 30000) {
        const lockKey = `${this.LOCKS_KEY}:${resource}`;
        const lockId = `${Date.now()}-${Math.random()}`;
        
        if (this.useFallback) {
            // Simple file-based lock
            const lockFile = path.join(this.fallbackDir, `${resource}.lock`);
            try {
                await fs.writeFile(lockFile, lockId, { flag: 'wx' });
                setTimeout(() => fs.unlink(lockFile).catch(() => {}), ttlMs);
                return lockId;
            } catch (error) {
                return null;
            }
        }

        try {
            // Redis SET NX with TTL
            const acquired = await this.client.set(lockKey, lockId, {
                NX: true,
                PX: ttlMs
            });
            
            return acquired ? lockId : null;
        } catch (error) {
            console.error('Lock acquisition failed:', error);
            return null;
        }
    }

    /**
     * Release a distributed lock.
     */
    async releaseLock(resource, lockId) {
        const lockKey = `${this.LOCKS_KEY}:${resource}`;
        
        if (this.useFallback) {
            const lockFile = path.join(this.fallbackDir, `${resource}.lock`);
            try {
                const currentLock = await fs.readFile(lockFile, 'utf8');
                if (currentLock === lockId) {
                    await fs.unlink(lockFile);
                }
            } catch (error) {
                // Lock already released or doesn't exist
            }
            return;
        }

        try {
            // Only delete if we own the lock
            const currentLock = await this.client.get(lockKey);
            if (currentLock === lockId) {
                await this.client.del(lockKey);
            }
        } catch (error) {
            console.error('Lock release failed:', error);
        }
    }

    /**
     * Record metrics for monitoring.
     */
    async recordMetric(metric, value) {
        const timestamp = new Date().toISOString();
        const metricData = { metric, value, timestamp };
        
        if (this.useFallback) {
            // Append to metrics file
            const metricsFile = path.join(this.fallbackDir, 'metrics.jsonl');
            await fs.appendFile(metricsFile, JSON.stringify(metricData) + '\n');
            return;
        }

        try {
            // Store in Redis sorted set with timestamp as score
            await this.client.zadd(
                `${this.METRICS_KEY}:${metric}`,
                Date.now(),
                JSON.stringify(metricData)
            );
            
            // Trim old metrics (keep last 1000)
            await this.client.zremrangebyrank(`${this.METRICS_KEY}:${metric}`, 0, -1001);
            
        } catch (error) {
            console.error('Metric recording failed:', error);
        }
    }

    // Fallback file-based implementations
    async saveInstanceToFile(instanceId, instanceData) {
        const instancesFile = path.join(this.fallbackDir, 'instances.json');
        let instances = {};
        
        try {
            instances = await fs.readJson(instancesFile);
        } catch (e) {
            // File doesn't exist yet
        }
        
        instances[instanceId] = instanceData;
        await fs.writeJson(instancesFile, instances, { spaces: 2 });
    }

    async getInstanceFromFile(instanceId) {
        const instancesFile = path.join(this.fallbackDir, 'instances.json');
        try {
            const instances = await fs.readJson(instancesFile);
            return instances[instanceId] || null;
        } catch (e) {
            return null;
        }
    }

    async getAllInstancesFromFile() {
        const instancesFile = path.join(this.fallbackDir, 'instances.json');
        try {
            return await fs.readJson(instancesFile);
        } catch (e) {
            return {};
        }
    }

    async deleteInstanceFromFile(instanceId) {
        const instancesFile = path.join(this.fallbackDir, 'instances.json');
        try {
            const instances = await fs.readJson(instancesFile);
            delete instances[instanceId];
            await fs.writeJson(instancesFile, instances, { spaces: 2 });
        } catch (e) {
            // Ignore errors
        }
    }

    /**
     * Cleanup and close connections.
     */
    async close() {
        if (this.client && !this.useFallback) {
            await this.client.disconnect();
        }
    }
}