#!/usr/bin/env python3
"""
Simple script to send Enter key to all tmux sessions to unstick any waiting for input
"""

import subprocess
import sys

def get_tmux_sessions():
    """Get list of all tmux sessions"""
    try:
        result = subprocess.run(['tmux', 'list-sessions'], 
                              capture_output=True, text=True, check=True)
        sessions = []
        for line in result.stdout.strip().split('\n'):
            if line:
                session_name = line.split(':')[0]
                sessions.append(session_name)
        return sessions
    except subprocess.CalledProcessError:
        print("No tmux server is running or no sessions found.")
        return []
    except Exception as e:
        print(f"Error getting sessions: {e}")
        return []

def send_enter_to_session(session_name):
    """Send Enter key to a specific session"""
    try:
        subprocess.run(['tmux', 'send-keys', '-t', session_name, 'Enter'], 
                      check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to send Enter to {session_name}: {e}")
        return False

def main():
    print("🔍 Looking for tmux sessions...")
    
    sessions = get_tmux_sessions()
    
    if not sessions:
        print("No tmux sessions found.")
        return
    
    print(f"\nFound {len(sessions)} tmux session(s):")
    for session in sessions:
        print(f"  - {session}")
    
    print("\n📤 Sending Enter key to each session...")
    
    success_count = 0
    exec_sessions = []
    
    for session in sessions:
        if send_enter_to_session(session):
            print(f"✓ Sent Enter to: {session}")
            success_count += 1
            
            # Track claude_exec_* sessions
            if session.startswith('claude_exec_'):
                exec_sessions.append(session)
        else:
            print(f"✗ Failed to send Enter to: {session}")
    
    print(f"\n📊 Summary: Successfully sent Enter to {success_count}/{len(sessions)} sessions")
    
    if exec_sessions:
        print(f"\n🎯 Found {len(exec_sessions)} claude_exec_* session(s) that were updated:")
        for session in exec_sessions:
            print(f"  - {session}")
    
    print("\n✅ Done!")

if __name__ == "__main__":
    main()