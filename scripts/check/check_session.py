#!/usr/bin/env python3
import subprocess
import sys

SESSION_NAME = "claude_exec_1749369856326"

def run_command(cmd):
    """Run a command and return output, handling errors gracefully"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return -1, "", str(e)

# Check if session exists
print(f"Checking for session: {SESSION_NAME}")
exit_code, _, _ = run_command(f"tmux has-session -t {SESSION_NAME}")

if exit_code == 0:
    print(f"✓ Session {SESSION_NAME} exists")
    
    # Send Enter key
    print("Sending Enter key...")
    exit_code, stdout, stderr = run_command(f"tmux send-keys -t {SESSION_NAME} Enter")
    
    if exit_code == 0:
        print(f"✓ Successfully sent Enter key to session {SESSION_NAME}")
    else:
        print(f"✗ Failed to send Enter key: {stderr}")
else:
    print(f"✗ Session {SESSION_NAME} does not exist")

# List all tmux sessions
print("\nAll tmux sessions:")
exit_code, stdout, stderr = run_command("tmux list-sessions")

if exit_code == 0 and stdout:
    print(stdout)
    
    # Look for claude_exec sessions with long timestamps
    print("\nClaude exec sessions with long timestamps:")
    for line in stdout.split('\n'):
        if 'claude_exec_' in line and len(line.split('claude_exec_')[1].split(':')[0]) > 10:
            print(f"  - {line}")
else:
    print("No tmux sessions found")

# Also check for any sessions starting with 'claude_'
print("\nAll Claude-related sessions:")
exit_code, stdout, stderr = run_command("tmux list-sessions | grep claude_")
if exit_code == 0 and stdout:
    print(stdout)
else:
    print("No Claude sessions found")