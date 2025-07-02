# 🌍 Global Task Command Installation Guide

## Overview

Make the `task` command available from anywhere on your system, allowing you to run workflow automation from any directory.

## 🚀 Quick Installation

```bash
# From the workflows directory
./install_global.sh
```

This will create a symlink in `/usr/local/bin/task` pointing to the task script.

## 📋 Manual Installation

If you prefer to install manually or to a different location:

```bash
# Create symlink in /usr/local/bin (requires sudo)
sudo ln -s /Users/Mike/.claude/user/tmux-claude-mcp-server/workflows/task /usr/local/bin/task

# Or add to your PATH in ~/.bashrc or ~/.zshrc
export PATH="/Users/Mike/.claude/user/tmux-claude-mcp-server/workflows:$PATH"
```

## 🎯 Usage Examples

Once installed globally, you can run from anywhere:

### Basic Task
```bash
# From any directory
task "Create a function to validate email addresses"
```

### Phase Implementation Workflow
```bash
# Run the complete phase workflow
task "Implement user authentication module" --preset phase
```

### Debug Workflow
```bash
# Debug a specific issue
task "Fix memory leak in image processor" --preset debug
```

### Custom Stages
```bash
# Define your own workflow stages
task "Refactor database layer" --stages analyze,design,implement,test,deploy
```

### With Specific Instance
```bash
# Target a specific Claude instance
task "Add user avatars" --instance spec_1_1_123456
```

## 🔧 Available Presets

- **default**: implement → test → document → finalize
- **debug**: reproduce → diagnose → fix → verify
- **review**: analyze → refactor → test → commit
- **phase**: execute → compare → deduplicate → cleanup

## 📍 Working Directory

The task runs in your current directory, so:
- Config files are created in your current directory
- The Claude instance operates on files in your current directory
- Git operations happen in your current directory

## 🗑️ Uninstall

To remove the global command:

```bash
sudo rm /usr/local/bin/task
```

## 🛠️ Troubleshooting

### "Command not found"
- Ensure `/usr/local/bin` is in your PATH
- Try: `echo $PATH | grep /usr/local/bin`
- If missing, add to your shell config

### "Permission denied"
- Make sure the task script is executable: `chmod +x /path/to/task`
- Use sudo for symlink creation

### "No such file or directory"
- Verify the full path to the task script
- Ensure the tmux-claude-mcp-server is in the expected location

## 🎉 Success!

You can now run complex multi-stage workflows from anywhere with a simple command!