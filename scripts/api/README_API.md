# Programmatic API for tmux-claude-mcp-server

This directory contains utilities for programmatically integrating with tmux-claude-mcp-server from external applications.

## Overview

These utilities enable external applications to:
- Spawn executive instances to manage projects
- Monitor project progress in real-time
- Track completion status and milestones
- Get structured data about orchestration activities

## Available Scripts

### 1. `spawn_project_executive.js`

Universal launcher for starting a new project with an executive instance.

```bash
# Basic usage
node scripts/api/spawn_project_executive.js \
  --project-dir /path/to/your/project \
  --requirements-file requirements.md

# With project type and JSON output
node scripts/api/spawn_project_executive.js \
  --project-dir /my/web-app \
  --project-type web-app \
  --json
```

**Options:**
- `--project-dir` (required): Path to your project directory
- `--requirements-file`: Name of requirements file (default: requirements.md)
- `--project-type`: Type of project (web-app, api, cli, library, generic)
- `--executive-template`: Custom executive template file
- `--no-session`: Dry run without starting tmux
- `--json`: Return JSON output for programmatic use

**Output:**
Creates `.tmux_session_info.json` in project directory with session details.

### 2. `monitor_project.js`

Real-time monitoring of project orchestration activity with interactive controls.

```bash
# Monitor by project directory
node scripts/api/monitor_project.js --project-dir /my/project

# Monitor by session ID
node scripts/api/monitor_project.js --session-id claude_exec_123

# Get one-time JSON status
node scripts/api/monitor_project.js --project-dir /my/project --once --json
```

**Options:**
- `--project-dir` or `--session-id` (one required)
- `--once`: Show status once and exit
- `--json`: Output in JSON format
- `--summary`: Show summary only (no details)

**Interactive Commands (during monitoring):**
- `s` - Shutdown all instances
- `1-9` - Attach to numbered instance (use Ctrl+B then D to detach)
- `r` - Restart the entire project
- `q` - Quit monitor
- `Ctrl+C` - Exit monitor

### 3. `get_project_progress.js`

Get detailed progress metrics and completion percentage.

```bash
# Get progress summary
node scripts/api/get_project_progress.js --project-dir /my/project

# Get progress as percentage only
node scripts/api/get_project_progress.js --project-dir /my/project --format percentage

# Get detailed JSON progress
node scripts/api/get_project_progress.js --project-dir /my/project --format json --verbose
```

**Options:**
- `--project-dir` or `--session-id` (one required)
- `--format`: Output format (text, json, percentage)
- `--verbose`: Show detailed progress information

## Integration Examples

### Python Wrapper Example

```python
import subprocess
import json
import os

class TmuxClaudeProject:
    def __init__(self, project_dir):
        self.project_dir = project_dir
        self.api_dir = "/path/to/tmux-claude-mcp-server/scripts/api"
        
    def start(self, requirements_file="requirements.md", project_type="generic"):
        """Start the project with an executive"""
        cmd = [
            "node",
            os.path.join(self.api_dir, "spawn_project_executive.js"),
            "--project-dir", self.project_dir,
            "--requirements-file", requirements_file,
            "--project-type", project_type,
            "--json"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        return json.loads(result.stdout)
    
    def get_progress(self):
        """Get current progress percentage"""
        cmd = [
            "node", 
            os.path.join(self.api_dir, "get_project_progress.js"),
            "--project-dir", self.project_dir,
            "--format", "percentage"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.stdout.strip()
    
    def monitor(self):
        """Start live monitoring"""
        cmd = [
            "node",
            os.path.join(self.api_dir, "monitor_project.js"),
            "--project-dir", self.project_dir
        ]
        
        subprocess.run(cmd)

# Usage
project = TmuxClaudeProject("/my/web-app")
session_info = project.start(project_type="web-app")
print(f"Started: {session_info['sessionInfo']['sessionId']}")

# Check progress
progress = project.get_progress()
print(f"Progress: {progress}")
```

### Node.js Wrapper Example

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

class TmuxClaudeWrapper {
    constructor(apiPath) {
        this.apiPath = apiPath;
    }

    async startProject(projectDir, options = {}) {
        const args = [
            `--project-dir "${projectDir}"`,
            options.requirementsFile ? `--requirements-file "${options.requirementsFile}"` : '',
            options.projectType ? `--project-type ${options.projectType}` : '',
            '--json'
        ].filter(Boolean).join(' ');

        const { stdout } = await execAsync(
            `node ${this.apiPath}/spawn_project_executive.js ${args}`
        );
        
        return JSON.parse(stdout);
    }

    async getProgress(projectDir) {
        const { stdout } = await execAsync(
            `node ${this.apiPath}/get_project_progress.js --project-dir "${projectDir}" --format json`
        );
        
        return JSON.parse(stdout);
    }

    streamMonitor(projectDir, onData) {
        const child = exec(
            `node ${this.apiPath}/monitor_project.js --project-dir "${projectDir}" --json`
        );
        
        child.stdout.on('data', (data) => {
            try {
                const parsed = JSON.parse(data);
                onData(parsed);
            } catch (e) {
                // Handle non-JSON output
            }
        });
        
        return child;
    }
}

// Usage
const wrapper = new TmuxClaudeWrapper('/path/to/api');
const result = await wrapper.startProject('/my/project', {
    projectType: 'web-app'
});
```

## Project Structure Requirements

Your project directory should contain:

```
/your/project/
├── requirements.md      # Project requirements (or custom filename)
├── [other project files]
```

After launching, the system will create:

```
/your/project/
├── requirements.md      # Original (preserved)
├── CLAUDE.md           # Executive instructions (generated)
├── PROJECT_PLAN.md     # Created by executive
├── DESIGN_SYSTEM.md    # Created by executive (if applicable)
├── .tmux_session_info.json  # Session tracking
├── [implementation files]    # Created by managers/specialists
```

## Best Practices

1. **Requirements File**: Write clear, structured requirements similar to the e-commerce example
2. **Project Types**: Use appropriate project type for better executive guidance
3. **Monitoring**: Use the monitor tool during development for visibility
4. **Progress Tracking**: Poll progress periodically to update your UI
5. **Session Management**: Save session IDs for later reference
6. **Error Handling**: Always check JSON responses for `success` field

## Limitations

- Requires tmux to be installed and accessible
- Requires Claude Code CLI to be authenticated
- Each project needs its own directory
- Progress tracking is approximate until todo integration is complete

## Future Enhancements

- WebSocket support for real-time updates
- REST API wrapper for HTTP integration
- Docker container for isolated execution
- Progress webhooks for async notifications
- Template library for common project types