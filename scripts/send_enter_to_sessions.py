#!/usr/bin/env python3
import subprocess
import sys

def run_command(cmd):
    """Run a command and return output"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout, result.stderr, result.returncode
    except Exception as e:
        return "", str(e), 1

def main():
    # List all tmux sessions
    print("Listing tmux sessions...")
    stdout, stderr, code = run_command("tmux list-sessions")
    
    if code != 0:
        if "no server running" in stderr:
            print("No tmux server is running.")
            return
        else:
            print(f"Error listing sessions: {stderr}")
            return
    
    sessions = []
    for line in stdout.strip().split('\n'):
        if line:
            # Extract session name (first part before ':')
            session_name = line.split(':')[0]
            sessions.append(session_name)
    
    print(f"Found {len(sessions)} tmux sessions:")
    for session in sessions:
        print(f"  - {session}")
    
    # Send Enter key to each session
    print("\nSending Enter key to each session...")
    success_count = 0
    for session in sessions:
        cmd = f"tmux send-keys -t {session} Enter"
        stdout, stderr, code = run_command(cmd)
        if code == 0:
            print(f"✓ Sent Enter to session: {session}")
            success_count += 1
        else:
            print(f"✗ Failed to send Enter to session {session}: {stderr}")
    
    print(f"\nSummary: Successfully sent Enter to {success_count}/{len(sessions)} sessions")
    
    # Special focus on claude_exec_* sessions
    exec_sessions = [s for s in sessions if s.startswith('claude_exec_')]
    if exec_sessions:
        print(f"\nFound {len(exec_sessions)} claude_exec_* sessions that were updated:")
        for session in exec_sessions:
            print(f"  - {session}")

if __name__ == "__main__":
    main()