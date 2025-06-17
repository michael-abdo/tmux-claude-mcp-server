# Persistent Workflow System - Troubleshooting Guide

## Overview

This guide helps diagnose and resolve common issues with the Persistent Execute-Compare-Commit Workflow system.

## Quick Diagnosis

### Check System Status
```bash
# Check if tmux sessions are running
tmux list-sessions

# Check active instances
node scripts/mcp_bridge.js list '{}'

# Check if workflow process is running
ps aux | grep persistent_workflow
```

## Common Issues

### 1. Workflow Won't Start

**Symptoms:**
- Universal launcher hangs
- "Project root not found" error
- Process exits immediately

**Diagnosis:**
```bash
# Test universal launcher manually
./bin/workflow-start --help

# Check if project structure is correct
ls -la workflows/core/persistent_execute_compare_commit.yaml
ls -la src/workflow/run_persistent_workflow.cjs
```

**Solutions:**
1. **Missing project files:**
   ```bash
   # Ensure you're in the correct directory
   pwd
   # Should be: .../tmux-claude-mcp-server
   
   # Check required files exist
   find . -name "persistent_execute_compare_commit.yaml"
   ```

2. **Permission issues:**
   ```bash
   # Make launcher executable
   chmod +x bin/workflow-start
   
   # Fix file permissions
   chmod +x src/workflow/run_persistent_workflow.cjs
   ```

3. **Path resolution:**
   ```bash
   # Test from different directory
   cd /tmp
   /full/path/to/bin/workflow-start --help
   ```

### 2. Instance Spawn Failures

**Symptoms:**
- "Failed to spawn instance" error
- Timeout waiting for instance
- Authentication dialogs appear

**Diagnosis:**
```bash
# Test MCP bridge directly
node scripts/mcp_bridge.js spawn '{"role": "specialist", "workDir": "'$(pwd)'"}'

# Check Claude CLI is working
claude --version

# Check permissions
claude --dangerously-skip-permissions
```

**Solutions:**
1. **Authentication timeout:**
   - Wait for authentication to complete (up to 3 minutes)
   - Instance may spawn successfully despite timeout

2. **Permission dialogs:**
   - Use `--dangerously-skip-permissions` flag
   - Pre-authorize Claude in system settings

3. **MCP bridge issues:**
   ```bash
   # Kill existing Claude processes
   pkill -f claude
   
   # Restart with clean state
   tmux kill-server
   ```

### 3. Keyword Detection Problems

**Symptoms:**
- Claude says keyword but workflow doesn't progress
- Stages get stuck waiting for keywords
- Monitor errors

**Diagnosis:**
```bash
# Check instance output
node scripts/mcp_bridge.js read '{"instanceId": "YOUR_ID", "lines": 20}'

# Check for monitor processes
ps aux | grep keyword_monitor
```

**Solutions:**
1. **Keyword not detected:**
   - Ensure exact spelling: `EXECUTE_FINISHED`, `COMPARE_FINISHED`, `COMMIT_FINISHED`
   - Check for extra spaces or characters
   - Manually type keyword if needed

2. **Monitor stuck:**
   ```bash
   # Restart monitoring
   # The system will auto-recover after timeout
   # Or manually restart workflow
   ```

3. **Instance communication issues:**
   ```bash
   # Test communication
   node scripts/mcp_bridge.js send '{"instanceId": "YOUR_ID", "text": "test"}'
   ```

### 4. Workflow Timeout/Stuck

**Symptoms:**
- Workflow stops progressing
- No response to commands
- Stage timeout messages

**Diagnosis:**
```bash
# Check if instance is responsive
node scripts/mcp_bridge.js read '{"instanceId": "YOUR_ID", "lines": 5}'

# Check tmux session
tmux attach -t claude_YOUR_ID
```

**Solutions:**
1. **Instance timeout recovery:**
   - System automatically sends recovery prompts
   - Manually type the expected keyword
   - If stuck, restart from blank state

2. **Force recovery:**
   ```bash
   # Send recovery command
   node scripts/mcp_bridge.js send '{"instanceId": "YOUR_ID", "text": "EXECUTE_FINISHED"}'
   ```

3. **Complete restart:**
   ```bash
   # Kill stuck instance
   node scripts/mcp_bridge.js terminate '{"instanceId": "YOUR_ID"}'
   
   # Restart workflow
   ./bin/workflow-start
   ```

### 5. Multiple Instance Conflicts

**Symptoms:**
- Git conflicts
- File access errors
- Inconsistent behavior

**Solutions:**
1. **Separate working directories:**
   ```bash
   # Run workflows from different directories
   cd /project1 && workflow-start
   cd /project2 && workflow-start
   ```

2. **Clean up instances:**
   ```bash
   # List all instances
   node scripts/mcp_bridge.js list '{}'
   
   # Terminate old instances
   node scripts/mcp_bridge.js terminate '{"instanceId": "OLD_ID"}'
   ```

### 6. Auto-Attach Issues

**Symptoms:**
- New terminal doesn't open
- "Auto-attach failed" message
- Manual attachment required

**Platform-Specific Solutions:**

**macOS:**
```bash
# Check Terminal.app permissions
# System Preferences > Security & Privacy > Automation
# Ensure Terminal has necessary permissions

# Test manually
osascript -e 'tell application "Terminal" to do script "echo test"'
```

**Linux:**
```bash
# Check available terminals
which gnome-terminal
which xfce4-terminal

# Test terminal opening
gnome-terminal -- bash -c "echo test; exec bash"
```

### 7. Permission and Directory Issues

**Symptoms:**
- "Permission denied" errors
- Can't write to directory
- Worktree creation fails

**Solutions:**
1. **Directory permissions:**
   ```bash
   # Check current directory permissions
   ls -la .
   
   # Ensure write access
   chmod 755 .
   ```

2. **Git permissions:**
   ```bash
   # Check git repository status
   git status
   
   # Fix git permissions
   sudo chown -R $(whoami) .git/
   ```

3. **Fallback directory:**
   ```bash
   # Use home directory as fallback
   cd ~
   workflow-start
   ```

## Error Recovery Procedures

### Automatic Recovery

The system includes automatic recovery for:
- Keyword timeouts → Recovery prompts sent
- Dead instances → Replacement spawning
- Stuck workflows → Force recovery after delay
- Monitor errors → Automatic restart

### Manual Recovery Steps

1. **Identify the issue:**
   ```bash
   # Check system status
   node scripts/mcp_bridge.js list '{}'
   tmux list-sessions
   ```

2. **Clean slate restart:**
   ```bash
   # Kill all sessions
   tmux kill-server
   
   # Clear instance registry
   rm -f state/instances.json
   
   # Restart workflow
   ./bin/workflow-start
   ```

3. **Targeted recovery:**
   ```bash
   # Terminate specific instance
   node scripts/mcp_bridge.js terminate '{"instanceId": "PROBLEM_ID"}'
   
   # Restart workflow in current directory
   node src/workflow/run_persistent_workflow.cjs
   ```

## Performance Optimization

### Reduce Timeouts
```bash
# Start with debug mode for verbose output
./bin/workflow-start --debug

# Monitor resource usage
top -p $(pgrep -f persistent_workflow)
```

### Memory Management
```bash
# Check memory usage
ps aux | grep claude | awk '{print $4}' | paste -sd+ | bc

# Clean up old sessions periodically
tmux kill-server
```

## Advanced Debugging

### Enable Debug Mode
```bash
# Full debug output
./bin/workflow-start --debug

# Direct runner debug
node src/workflow/run_persistent_workflow.cjs --debug
```

### Log Analysis
```bash
# Follow workflow logs
tail -f /tmp/workflow_debug.log  # if logging enabled

# Monitor tmux session
tmux capture-pane -t claude_INSTANCE_ID -p
```

### Component Testing
```bash
# Test individual components
node test_keyword_timeout_recovery.cjs
node test_multiple_instances.cjs
node test_stuck_workflow_recovery.cjs
node test_mcp_bridge_failures.cjs
node test_directory_permissions.cjs
```

## When All Else Fails

### Complete System Reset
```bash
# Nuclear option - reset everything
tmux kill-server
pkill -f claude
pkill -f persistent_workflow
rm -f state/instances.json
rm -rf *-worktrees/

# Restart
./bin/workflow-start
```

### Emergency Manual Mode
```bash
# Skip automation, run manually
node scripts/mcp_bridge.js spawn '{"role": "specialist"}'
# Note the instance ID
node scripts/mcp_bridge.js send '{"instanceId": "ID", "text": "your command"}'
```

## Getting Help

### System Information for Bug Reports
```bash
# Gather system info
echo "Platform: $(uname -a)"
echo "Node: $(node --version)"
echo "Claude: $(claude --version 2>/dev/null || echo 'not found')"
echo "Working dir: $(pwd)"
echo "Git status: $(git status --porcelain | wc -l) changed files"

# Instance status
node scripts/mcp_bridge.js list '{}'

# Recent tmux sessions
tmux list-sessions 2>/dev/null || echo "No tmux sessions"
```

### Known Limitations

1. **Spawn timeouts**: Authentication can take up to 3 minutes
2. **Platform dependency**: Auto-attach works best on macOS
3. **Directory sensitivity**: Some operations require write permissions
4. **Resource usage**: Each instance uses ~100MB memory
5. **Concurrent limits**: Avoid more than 3-4 simultaneous workflows

## Prevention Tips

1. **Regular cleanup**: Kill old sessions weekly
2. **Directory hygiene**: Run from project root when possible
3. **Resource monitoring**: Check memory usage periodically
4. **Update regularly**: Keep Claude CLI updated
5. **Backup state**: Save important workflow configurations

---

*For additional help, check the project documentation or create an issue with your system information and error logs.*