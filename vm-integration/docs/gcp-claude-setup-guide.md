# GCP Claude Worker Setup Guide

A simple but scalable setup for running Claude Code instances on Google Cloud Platform (Iowa region) with spot instances.

## Overview

This setup allows you to:
- Start with 1 instance at $0.022/hour
- Scale to 50+ instances easily
- Use GitHub for task distribution and output collection
- Automatically handle spot instance preemption
- Monitor your fleet performance

## 1. Initial Setup Script

**`setup-gcp.sh`** (run on your local machine)

```bash
#!/bin/bash

# Configuration
PROJECT_ID="your-project-id"  # Change this!
REGION="us-central1"
ZONE="us-central1-a"
GITHUB_REPO="https://github.com/yourusername/claude-outputs.git"  # Change this!

# Set default project
gcloud config set project $PROJECT_ID

# Create service account for instances
gcloud iam service-accounts create claude-worker \
    --display-name="Claude Worker Instance"

# Create firewall rule for monitoring (optional)
gcloud compute firewall-rules create allow-claude-monitoring \
    --allow tcp:9090 \
    --source-ranges="0.0.0.0/0" \
    --target-tags=claude-worker

# Create the startup script
cat > claude-startup.sh << 'EOF'
#!/bin/bash
# This script runs on every VM startup

# Install basics
apt-get update
apt-get install -y git curl python3-pip

# Install Claude Code (replace with actual install command)
curl -fsSL https://claude-code-install-url.sh | sh

# Setup git
git config --global user.email "bot@claude-worker.local"
git config --global user.name "Claude Worker"

# Create work directory
mkdir -p /home/claude-worker
cd /home/claude-worker

# Clone the repo (will be replaced with actual repo via metadata)
GITHUB_REPO=$(curl -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/instance/attributes/github-repo)
git clone $GITHUB_REPO workspace
cd workspace

# Create systemd service for Claude
cat > /etc/systemd/system/claude-worker.service << 'INNER_EOF'
[Unit]
Description=Claude Code Worker
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/claude-worker/workspace
ExecStart=/usr/local/bin/claude-code-runner.sh
Restart=always
RestartSec=30
Environment="INSTANCE_ID=%i"

[Install]
WantedBy=multi-user.target
INNER_EOF

# Create the runner script
cat > /usr/local/bin/claude-code-runner.sh << 'INNER_EOF'
#!/bin/bash
while true; do
    # Pull latest tasks
    git pull origin main
    
    # Check for new task
    if [ -f "tasks/next.txt" ]; then
        TASK=$(cat tasks/next.txt)
        
        # Run Claude Code with the task
        claude-code "$TASK" > output.txt 2>&1
        
        # Save output
        mkdir -p completed/$(date +%Y%m%d)
        mv output.txt completed/$(date +%Y%m%d)/task-$(date +%s).txt
        
        # Commit and push
        git add completed/
        git commit -m "Completed task: $(date)"
        git push origin main
        
        # Mark task as done
        rm tasks/next.txt
        git commit -am "Task completed"
        git push origin main
    fi
    
    # Wait before checking again
    sleep 10
done
INNER_EOF

chmod +x /usr/local/bin/claude-code-runner.sh

# Enable and start the service
systemctl enable claude-worker
systemctl start claude-worker

# Setup monitoring endpoint
pip3 install prometheus-client
cat > /usr/local/bin/claude-metrics.py << 'INNER_EOF'
#!/usr/bin/env python3
from prometheus_client import start_http_server, Gauge
import psutil
import time

# Create metrics
cpu_usage = Gauge('claude_cpu_usage', 'CPU usage percentage')
memory_usage = Gauge('claude_memory_usage', 'Memory usage percentage')
tasks_completed = Gauge('claude_tasks_completed', 'Number of tasks completed')

def collect_metrics():
    while True:
        cpu_usage.set(psutil.cpu_percent(interval=1))
        memory_usage.set(psutil.virtual_memory().percent)
        # Count completed tasks
        import subprocess
        count = subprocess.check_output(['find', '/home/claude-worker/workspace/completed', '-type', 'f', '|', 'wc', '-l'], shell=True)
        tasks_completed.set(int(count.strip()))
        time.sleep(10)

if __name__ == '__main__':
    start_http_server(9090)
    collect_metrics()
INNER_EOF

chmod +x /usr/local/bin/claude-metrics.py
nohup /usr/local/bin/claude-metrics.py &

EOF

# Upload the startup script
gsutil cp claude-startup.sh gs://$PROJECT_ID-claude-scripts/

echo "Setup complete! Now create your first instance with:"
echo "./create-instance.sh 1"
```

## 2. Instance Creation Script

**`create-instance.sh`** (scalable launcher)

```bash
#!/bin/bash

# Usage: ./create-instance.sh [instance-number]
INSTANCE_NUM=${1:-1}
PROJECT_ID="your-project-id"  # Change this!
ZONE="us-central1-a"
GITHUB_REPO="https://github.com/yourusername/claude-outputs.git"  # Change this!

# Create the instance
gcloud compute instances create claude-worker-$INSTANCE_NUM \
    --project=$PROJECT_ID \
    --zone=$ZONE \
    --machine-type=e2-standard-4 \
    --provisioning-model=SPOT \
    --instance-termination-action=STOP \
    --max-run-duration=6h \
    --network-interface=network-tier=STANDARD,subnet=default \
    --maintenance-policy=TERMINATE \
    --service-account=claude-worker@$PROJECT_ID.iam.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=claude-worker \
    --create-disk=auto-delete=yes,boot=yes,device-name=claude-worker-$INSTANCE_NUM,image=projects/ubuntu-os-cloud/global/images/ubuntu-2204-jammy-v20231213,mode=rw,size=50,type=pd-standard \
    --metadata=startup-script-url=gs://$PROJECT_ID-claude-scripts/claude-startup.sh,github-repo=$GITHUB_REPO \
    --labels=type=claude-worker,instance-num=$INSTANCE_NUM

echo "Instance claude-worker-$INSTANCE_NUM created!"
echo "Check status: gcloud compute instances list --filter='name:claude-worker-$INSTANCE_NUM'"
```

## 3. Scaling Script

**`scale-claude.sh`** (scale to any number)

```bash
#!/bin/bash

# Usage: ./scale-claude.sh [target-count]
TARGET=${1:-10}
CURRENT=$(gcloud compute instances list --filter="labels.type=claude-worker" --format="value(name)" | wc -l)

echo "Current instances: $CURRENT"
echo "Target instances: $TARGET"

if [ $CURRENT -lt $TARGET ]; then
    # Scale up
    for i in $(seq $((CURRENT + 1)) $TARGET); do
        echo "Creating instance $i..."
        ./create-instance.sh $i &
        sleep 2  # Avoid API rate limits
    done
    wait
    echo "Scaled up to $TARGET instances"
elif [ $CURRENT -gt $TARGET ]; then
    # Scale down
    for i in $(seq $TARGET $((CURRENT - 1))); do
        echo "Deleting instance $i..."
        gcloud compute instances delete claude-worker-$i --zone=us-central1-a --quiet &
    done
    wait
    echo "Scaled down to $TARGET instances"
else
    echo "Already at target count"
fi
```

## 4. Management Dashboard

**`monitor.py`** (simple monitoring)

```python
#!/usr/bin/env python3
import subprocess
import json
import time
from datetime import datetime

def get_instances():
    """Get all Claude worker instances"""
    cmd = [
        "gcloud", "compute", "instances", "list",
        "--filter=labels.type=claude-worker",
        "--format=json"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)

def check_instance_metrics(instance_name, zone):
    """Get CPU usage for an instance"""
    # Get instance IP
    cmd = [
        "gcloud", "compute", "instances", "describe", instance_name,
        "--zone", zone, "--format=value(networkInterfaces[0].accessConfigs[0].natIP)"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    ip = result.stdout.strip()
    
    if ip:
        # Try to fetch metrics from the instance
        try:
            import requests
            resp = requests.get(f"http://{ip}:9090/metrics", timeout=5)
            for line in resp.text.split('\n'):
                if line.startswith('claude_cpu_usage'):
                    return float(line.split()[-1])
        except:
            return None
    return None

def main():
    print("Claude Worker Fleet Monitor")
    print("=" * 50)
    
    while True:
        instances = get_instances()
        active_count = 0
        total_cpu = 0
        
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Fleet Status:")
        print(f"{'Instance':<20} {'Status':<10} {'CPU %':<10} {'Zone':<15}")
        print("-" * 55)
        
        for inst in instances:
            name = inst['name']
            status = inst['status']
            zone = inst['zone'].split('/')[-1]
            
            cpu = check_instance_metrics(name, zone)
            if cpu is not None:
                active_count += 1
                total_cpu += cpu
                cpu_str = f"{cpu:.1f}%"
            else:
                cpu_str = "N/A"
            
            print(f"{name:<20} {status:<10} {cpu_str:<10} {zone:<15}")
        
        print("-" * 55)
        print(f"Total instances: {len(instances)}")
        print(f"Active instances: {active_count}")
        if active_count > 0:
            print(f"Average CPU: {total_cpu/active_count:.1f}%")
        
        # Check for preempted instances
        preempted = [i for i in instances if i['status'] == 'TERMINATED']
        if preempted:
            print(f"\n⚠️  {len(preempted)} instances preempted! Run './scale-claude.sh' to replace them.")
        
        time.sleep(30)

if __name__ == "__main__":
    main()
```

## 5. GitHub Repository Structure

Create this structure in your GitHub repo:

```
claude-outputs/
├── tasks/
│   └── next.txt          # Current task for Claude
├── completed/
│   └── 20240113/         # Organized by date
│       └── task-*.txt    # Completed outputs
├── logs/
│   └── errors.log        # Any errors
└── README.md
```

## Quick Start Commands

```bash
# 1. First time setup
chmod +x *.sh
./setup-gcp.sh

# 2. Create your first instance
./create-instance.sh 1

# 3. Check it's running
gcloud compute instances list --filter="labels.type=claude-worker"

# 4. SSH to debug if needed
gcloud compute ssh claude-worker-1 --zone=us-central1-a

# 5. Scale to 10 instances
./scale-claude.sh 10

# 6. Monitor your fleet
python3 monitor.py

# 7. Push a task
echo "Create a Python script that calculates prime numbers" > tasks/next.txt
git add tasks/next.txt
git commit -m "New task"
git push
```

## Cost Projection

| Instances | Cost/Hour | Cost/Day | Cost/Month |
|-----------|-----------|----------|------------|
| 1         | $0.022    | $0.53    | $16        |
| 10        | $0.22     | $5.28    | $158       |
| 50        | $1.10     | $26.40   | $792       |

## VM Specifications

- **Machine Type**: e2-standard-4
- **vCPUs**: 4
- **Memory**: 16 GB
- **Disk**: 50 GB standard persistent disk
- **Spot Pricing**: ~$0.022/hour (us-central1)
- **Max Run Duration**: 6 hours (then auto-restarts)

## Next Steps for Scale

1. **Add task queue** - Replace single `next.txt` with a proper queue system
2. **Implement preemption recovery** - Auto-restart terminated instances
3. **Add Terraform** - Infrastructure as code for better management
4. **Setup Grafana** - Beautiful dashboards for monitoring
5. **Multi-region deployment** - Distribute across regions for IP diversity
6. **Add authentication** - Secure your GitHub repo with deploy keys
7. **Implement rate limiting** - Respect Anthropic's API limits
8. **Add error handling** - Retry logic for failed tasks
9. **Cost optimization** - Use committed use discounts for stable workloads
10. **Backup strategy** - Regular backups of completed work

## Troubleshooting

### Instance won't start
```bash
# Check startup script logs
gcloud compute instances get-serial-port-output claude-worker-1 --zone=us-central1-a
```

### Can't connect to monitoring
```bash
# Check firewall rules
gcloud compute firewall-rules list --filter="name:allow-claude-monitoring"
```

### GitHub push failures
```bash
# SSH to instance and check git status
gcloud compute ssh claude-worker-1 --zone=us-central1-a
cd /home/claude-worker/workspace
git status
git remote -v
```

### High preemption rate
- Consider using regular instances for critical workloads
- Implement automatic respawn in monitoring script
- Use multiple zones to spread risk

## Security Considerations

1. Use deploy keys for GitHub instead of personal tokens
2. Restrict service account permissions
3. Enable OS Login for better access control
4. Use private IPs if possible
5. Regularly update instances

---

This setup provides a solid foundation for scaling Claude Code instances from 1 to 100+ with minimal operational overhead.