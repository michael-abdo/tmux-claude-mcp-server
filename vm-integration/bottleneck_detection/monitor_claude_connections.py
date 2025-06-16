#!/usr/bin/env python3
import subprocess
import time
import psutil

def monitor_claude_connections():
    """Track connection growth over time"""
    
    # Start a fresh Claude instance in non-interactive mode
    proc = subprocess.Popen(['claude-code', '--print', '--dangerously-skip-permissions', 'test'])
    pid = proc.pid
    
    print(f"Monitoring PID {pid}")
    print("Time\tConnections\tCPU%\tMemory MB")
    print("-" * 40)
    
    for i in range(300):  # Monitor for 5 minutes
        try:
            p = psutil.Process(pid)
            connections = len(p.connections())
            cpu = p.cpu_percent(interval=0.1)
            memory = p.memory_info().rss / 1024 / 1024
            
            print(f"{i}s\t{connections}\t{cpu:.1f}%\t{memory:.0f}MB")
            
            if connections > 50:
                print("\n⚠️  ABNORMAL CONNECTION COUNT!")
                # List all connections
                for conn in p.connections():
                    print(f"  {conn.laddr} -> {conn.raddr} [{conn.status}]")
                break
                
        except psutil.NoSuchProcess:
            print("Process ended")
            break
            
        time.sleep(1)

if __name__ == "__main__":
    monitor_claude_connections()