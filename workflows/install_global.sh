#!/bin/bash

# Install script to make 'task' command globally available

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TASK_SCRIPT="$SCRIPT_DIR/task"
SYMLINK_PATH="/usr/local/bin/task"

echo "🚀 Installing 'task' command globally..."

# Check if task script exists
if [ ! -f "$TASK_SCRIPT" ]; then
    echo "❌ Error: task script not found at $TASK_SCRIPT"
    exit 1
fi

# Make sure task script is executable
chmod +x "$TASK_SCRIPT"

# Create /usr/local/bin if it doesn't exist
if [ ! -d "/usr/local/bin" ]; then
    echo "📁 Creating /usr/local/bin directory..."
    sudo mkdir -p /usr/local/bin
fi

# Create symlink
if [ -L "$SYMLINK_PATH" ]; then
    echo "🔗 Removing existing symlink..."
    sudo rm "$SYMLINK_PATH"
fi

echo "🔗 Creating symlink from $TASK_SCRIPT to $SYMLINK_PATH"
sudo ln -s "$TASK_SCRIPT" "$SYMLINK_PATH"

# Verify installation
if [ -L "$SYMLINK_PATH" ]; then
    echo "✅ Installation successful!"
    echo ""
    echo "You can now use 'task' from anywhere:"
    echo "  task \"Create a user authentication module\""
    echo "  task \"Fix memory leak\" --preset debug"
    echo "  task \"Implement OAuth integration\" --preset phase"
    echo ""
    echo "To uninstall, run: sudo rm $SYMLINK_PATH"
else
    echo "❌ Installation failed"
    exit 1
fi