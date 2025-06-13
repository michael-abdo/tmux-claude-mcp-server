# Job Management Guide

## Overview
This guide provides commands and workflows for managing Claude orchestration jobs.

## 1. View All Working Jobs

### Interactive Dashboard (Recommended)
```bash
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/monitor_all_projects.js --scan-dir /Users/Mike/Desktop/programming
```

**Features:**
- Real-time status of all projects
- Progress bars showing completion percentage
- Instance counts (Executive/Manager/Specialist)
- Runtime duration
- Interactive commands to focus on specific projects

### List tmux Sessions
```bash
tmux list-sessions | grep claude
```
Shows all Claude sessions with creation timestamps.

## 2. Connect to a Specific Job

### Option A: Attach to tmux Session (Interactive)
```bash
tmux attach -t claude_exec_1748809217204
```
- **Real-time view** of Claude's current actions
- **Fully interactive** - send commands directly
- **To detach**: Press `Ctrl+B` then `D`

### Option B: Monitor Project (Read-only)
```bash
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/monitor_project.js --session-id claude_exec_1748809217204
```
- **Read-only** monitoring dashboard
- Shows progress, todos, recent activity
- Auto-refreshes every few seconds

### Option C: Quick Status Check
```bash
tmux capture-pane -t claude_exec_1748809217204 -p | tail -20
```
- Shows last 20 lines of output
- Good for quick status checks

## 3. Start a New Job

### Basic Usage
```bash
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
  --project-dir /path/to/your/project \
  --project-type web-app \
  --requirements-file requirements.md
```

### Parameters
- `--project-dir` (required) - Path to project folder
- `--project-type` - Options: `web-app`, `api`, `cli`, `library`, `generic`
- `--requirements-file` - Name of requirements file (default: `requirements.md`)

### Example: New Upwork Job
```bash
# Create project directory
mkdir -p /Users/Mike/Desktop/programming/2_proposals/upwork/job_123456

# Add requirements
echo "Build a React dashboard..." > /Users/Mike/Desktop/programming/2_proposals/upwork/job_123456/requirements.md

# Start the job
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
  --project-dir /Users/Mike/Desktop/programming/2_proposals/upwork/job_123456 \
  --project-type web-app
```

## 4. Find Jobs by Directory

### Find Active Projects
```bash
find /Users/Mike/Desktop/programming -name ".tmux_session_info.json" -exec grep -l "running" {} \;
```

### Get Session Info from Project
```bash
cat /path/to/project/.tmux_session_info.json
```

## 5. Manage Stuck or Problematic Jobs

### Kill Specific Session
```bash
tmux kill-session -t claude_exec_[SESSION_ID]
```

### Kill All Claude Sessions
```bash
tmux list-sessions | grep claude | cut -d: -f1 | xargs -I {} tmux kill-session -t {}
```

### Restart Stuck Project
```bash
# First kill the stuck session
tmux kill-session -t claude_exec_[OLD_SESSION_ID]

# Then restart
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
  --project-dir /path/to/stuck/project \
  --project-type web-app
```

## 6. Quick Reference Card

```bash
# View all jobs (interactive)
node scripts/api/monitor_all_projects.js --scan-dir /Users/Mike/Desktop/programming

# List tmux sessions
tmux ls | grep claude

# Connect to job (interactive)
tmux attach -t claude_exec_[SESSION_ID]

# Detach from session
Ctrl+B, then D

# Monitor job (read-only)
node scripts/api/monitor_project.js --session-id claude_exec_[SESSION_ID]

# Quick status check
tmux capture-pane -t claude_exec_[SESSION_ID] -p | tail -20

# Start new job
node scripts/api/spawn_project_executive.js --project-dir /path/to/project

# Kill session
tmux kill-session -t claude_exec_[SESSION_ID]
```

## 7. Tips and Best Practices

1. **Use the interactive dashboard** for overview of all projects
2. **Attach to tmux sessions** when you need to intervene or guide
3. **Monitor mode** is best for checking progress without interrupting
4. **Always detach properly** with Ctrl+B, D (don't just close terminal)
5. **Check session info files** in project directories for metadata
6. **Restart stuck projects** rather than trying to unstick them

## 8. Common Issues and Solutions

### Project Stuck at "Bypassing Permissions"
- Kill session and restart with spawn script
- New spawn script avoids this by sending direct action commands

### Can't Find Session
- Check `.tmux_session_info.json` in project directory
- Use `find` command to locate session info files
- Session may have been killed or crashed

### Multiple Sessions for Same Project
- Check timestamps in `tmux ls`
- Kill older sessions, keep newest
- Update `.tmux_session_info.json` if needed