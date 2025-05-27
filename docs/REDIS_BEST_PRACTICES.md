# Redis Configuration Best Practices for tmux-claude

## Overview

This guide provides best practices for configuring Redis when using tmux-claude in Phase 3 (parallel execution mode). While Redis is optional (the system falls back to JSON), it's recommended for production deployments with multiple concurrent instances.

## Installation

### macOS
```bash
brew install redis
brew services start redis
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### Docker
```bash
docker run -d --name tmux-claude-redis -p 6379:6379 redis:7-alpine
```

## Configuration

### 1. Connection Settings

Set the Redis URL in your environment:
```bash
export REDIS_URL="redis://localhost:6379"
# Or with password
export REDIS_URL="redis://:password@localhost:6379"
```

### 2. Recommended Redis Configuration

Edit `/etc/redis/redis.conf` or create a custom config:

```conf
# Persistence - Enable AOF for durability
appendonly yes
appendfsync everysec

# Memory Management
maxmemory 2gb
maxmemory-policy allkeys-lru

# Performance
tcp-keepalive 60
timeout 300

# Security (if exposed)
requirepass your_strong_password
bind 127.0.0.1 ::1

# Disable dangerous commands
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 3. Connection Pooling

The tmux-claude Redis client uses connection pooling by default:
```javascript
// Automatically configured in RedisStateStore
{
  socket: {
    connectTimeout: 5000,
    keepAlive: 30000
  },
  pool: {
    min: 2,
    max: 10
  }
}
```

## Performance Optimization

### 1. Key Expiration Strategy

tmux-claude uses TTL for temporary data:
- Lock keys: 30 seconds
- Temporary state: 5 minutes
- Metrics: 24 hours

### 2. Memory Usage Estimation

Calculate memory needs:
- Per instance: ~5KB
- Per job: ~2KB
- Per metric: ~1KB

For 100 concurrent instances with 1000 jobs:
```
100 instances × 5KB = 500KB
1000 jobs × 2KB = 2MB
10000 metrics × 1KB = 10MB
Total: ~15MB (very lightweight)
```

### 3. Monitoring Commands

Monitor Redis performance:
```bash
# Real-time statistics
redis-cli --stat

# Memory usage
redis-cli info memory

# Connected clients
redis-cli client list

# Slow queries
redis-cli slowlog get 10
```

## High Availability Setup

### 1. Redis Sentinel (Recommended)

For automatic failover, configure Redis Sentinel:

```conf
# sentinel.conf
port 26379
sentinel monitor tmux-claude-master 127.0.0.1 6379 2
sentinel down-after-milliseconds tmux-claude-master 5000
sentinel parallel-syncs tmux-claude-master 1
sentinel failover-timeout tmux-claude-master 10000
```

Start Sentinel:
```bash
redis-sentinel /path/to/sentinel.conf
```

Update connection string:
```bash
export REDIS_URL="redis-sentinel://localhost:26379,localhost:26380,localhost:26381/tmux-claude-master"
```

### 2. Redis Cluster

For horizontal scaling:
```bash
# Create cluster
redis-cli --cluster create \
  127.0.0.1:7000 127.0.0.1:7001 127.0.0.1:7002 \
  127.0.0.1:7003 127.0.0.1:7004 127.0.0.1:7005 \
  --cluster-replicas 1
```

## Backup and Recovery

### 1. Automated Backups

Create backup script:
```bash
#!/bin/bash
# backup-redis.sh
BACKUP_DIR="/var/backups/redis"
mkdir -p $BACKUP_DIR

# Save RDB snapshot
redis-cli BGSAVE
sleep 2

# Copy files
cp /var/lib/redis/dump.rdb $BACKUP_DIR/dump-$(date +%Y%m%d-%H%M%S).rdb
cp /var/lib/redis/appendonly.aof $BACKUP_DIR/aof-$(date +%Y%m%d-%H%M%S).aof

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
```

Add to cron:
```bash
0 */6 * * * /path/to/backup-redis.sh
```

### 2. Recovery Procedure

1. Stop Redis: `sudo systemctl stop redis`
2. Replace data files:
   ```bash
   cp /backup/dump.rdb /var/lib/redis/
   cp /backup/appendonly.aof /var/lib/redis/
   ```
3. Start Redis: `sudo systemctl start redis`

## Security Best Practices

### 1. Network Security

- Bind to localhost only unless distributed
- Use firewall rules for Redis ports
- Enable SSL/TLS for remote connections:
  ```conf
  tls-port 6380
  port 0
  tls-cert-file /path/to/cert.pem
  tls-key-file /path/to/key.pem
  ```

### 2. Authentication

- Always set a strong password
- Use ACL for fine-grained permissions:
  ```bash
  ACL SETUSER tmux-claude +@all -@dangerous ~* &* on >strong_password
  ```

### 3. Command Restrictions

Disable dangerous commands:
```conf
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG ""
rename-command SHUTDOWN ""
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check Redis is running: `redis-cli ping`
   - Verify bind address matches connection
   - Check firewall rules

2. **Memory Issues**
   - Monitor memory: `redis-cli info memory`
   - Adjust maxmemory setting
   - Check eviction policy

3. **Performance Degradation**
   - Check slow log: `redis-cli slowlog get`
   - Monitor client connections
   - Review key expiration settings

### Debug Commands

```bash
# Test connectivity
redis-cli ping

# Monitor commands in real-time
redis-cli monitor

# Check configuration
redis-cli config get '*'

# View all keys (careful in production)
redis-cli --scan --pattern 'tmux-claude:*'
```

## Monitoring and Alerts

### 1. Key Metrics to Monitor

- Memory usage percentage
- Connected clients count
- Commands per second
- Hit rate percentage
- Evicted keys count

### 2. Prometheus Integration

Add Redis exporter:
```yaml
# docker-compose.yml
redis_exporter:
  image: oliver006/redis_exporter
  environment:
    REDIS_ADDR: "redis://redis:6379"
  ports:
    - "9121:9121"
```

### 3. Alert Rules

Example Prometheus alerts:
```yaml
groups:
  - name: redis
    rules:
      - alert: RedisDown
        expr: redis_up == 0
        for: 5m
        
      - alert: RedisMemoryHigh
        expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
        for: 5m
        
      - alert: RedisTooManyConnections
        expr: redis_connected_clients > 100
        for: 5m
```

## Optimization for tmux-claude

### 1. Key Naming Convention

tmux-claude uses prefixed keys:
- `tmux-claude:instance:{id}` - Instance data
- `tmux-claude:job:{id}` - Job information
- `tmux-claude:lock:{resource}` - Distributed locks
- `tmux-claude:metrics:{type}` - Performance metrics

### 2. Cleanup Policy

Implement automatic cleanup:
```lua
-- cleanup.lua
local keys = redis.call('keys', 'tmux-claude:instance:*')
for i=1,#keys do
  local data = redis.call('get', keys[i])
  local instance = cjson.decode(data)
  if instance.status == 'terminated' then
    redis.call('expire', keys[i], 3600)
  end
end
```

Schedule cleanup:
```bash
redis-cli --eval cleanup.lua
```

## Conclusion

Following these best practices ensures optimal performance and reliability when using Redis with tmux-claude. Remember that Redis is optional - the system works well with JSON fallback for smaller deployments.