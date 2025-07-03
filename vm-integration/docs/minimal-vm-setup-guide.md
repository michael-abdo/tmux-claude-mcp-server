# Minimal VM Setup for Claude Code Development (Scalable)

## Core Pipeline Steps

### 1. **Initial Setup (Do Once)**
```bash
# Launch VM with user data script (automates setup)
aws ec2 run-instances --image-id ami-0c02fb55956c7d316 \
  --instance-type m5.xlarge \
  --key-name your-key \
  --user-data file://setup.sh
```

### 2. **Development Workflow (Daily)**
```bash
# Connect to VM
ssh -i your-key.pem ubuntu@vm-ip

# Clone/switch project  
git clone your-repo && cd your-repo

# Start Claude Code
claude-code

# Work normally - Claude edits files, runs tests, commits
# When done, push changes
git push origin main
```

### 3. **Local Testing (As Needed)**
```bash
# On your local machine
git pull origin main
npm test  # or your test command
# Provide feedback via SSH or commit comments
```

---

## MINIMAL SETUP (15 minutes to working state)

### A. Create This Setup Script (`setup.sh`)
```bash
#!/bin/bash
# Auto-setup script for Claude Code development VM

# Update system
apt-get update -y

# Install essentials
apt-get install -y git curl build-essential

# Install Node.js (adjust for your stack)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install Claude Code
pip install claude-code  # or whatever the install method is

# Setup Git (replace with your details)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# Setup SSH for GitHub
ssh-keygen -t ed25519 -C "vm@yourproject" -f /home/ubuntu/.ssh/id_ed25519 -N ""
cat /home/ubuntu/.ssh/id_ed25519.pub  # Copy this to GitHub

# Create workspace directory
mkdir -p /home/ubuntu/projects
chown -R ubuntu:ubuntu /home/ubuntu/projects

echo "VM setup complete! Add the SSH key above to GitHub."
```

### B. Launch VM with Auto-Setup
```bash
# Create one VM (test first)
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type m5.xlarge \
  --key-name your-existing-key \
  --security-group-ids sg-yourgroup \
  --user-data file://setup.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=claude-dev-1}]'
```

### C. Connect and Start Working
```bash
# Get IP address
aws ec2 describe-instances --filters "Name=tag:Name,Values=claude-dev-1" \
  --query 'Reservations[0].Instances[0].PublicIpAddress'

# SSH in
ssh -i your-key.pem ubuntu@<VM-IP>

# Clone your first project
git clone git@github.com:your-username/your-repo.git
cd your-repo

# Start Claude Code
claude-code
```

---

## SCALING STRATEGY (When You Need More)

### 1. **Create VM Template (AMI)**
```bash
# After setting up first VM perfectly:
aws ec2 create-image \
  --instance-id i-1234567890abcdef0 \
  --name "claude-dev-template" \
  --description "Pre-configured Claude Code development environment"
```

### 2. **Launch Multiple VMs from Template**
```bash
# Launch 5 VMs instantly
for i in {1..5}; do
  aws ec2 run-instances \
    --image-id ami-yourtemplateami \
    --instance-type m5.xlarge \
    --key-name your-key \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=claude-dev-$i}]"
done
```

### 3. **Auto-Connect Script**
```bash
#!/bin/bash
# connect.sh - Easy VM switching

INSTANCE_NAME=$1
IP=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$INSTANCE_NAME" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

ssh -i ~/.ssh/your-key.pem ubuntu@$IP
```

Usage: `./connect.sh claude-dev-3`

---

## EVEN SIMPLER: Use AWS Launch Template

### Create Launch Template (One-Time)
```bash
aws ec2 create-launch-template \
  --launch-template-name claude-dev-template \
  --launch-template-data '{
    "ImageId": "ami-0c02fb55956c7d316",
    "InstanceType": "m5.xlarge",
    "KeyName": "your-key",
    "UserData": "'$(base64 -w 0 setup.sh)'",
    "TagSpecifications": [{
      "ResourceType": "instance", 
      "Tags": [{"Key": "Project", "Value": "claude-dev"}]
    }]
  }'
```

### Launch New VMs Instantly
```bash
# Single command to launch new dev environment
aws ec2 run-instances --launch-template LaunchTemplateName=claude-dev-template
```

---

## MINIMAL REQUIRED AWS SETUP

### 1. **Security Group** (One-Time)
```bash
aws ec2 create-security-group \
  --group-name claude-dev-sg \
  --description "Claude development environments"

# Allow SSH from your IP only
aws ec2 authorize-security-group-ingress \
  --group-name claude-dev-sg \
  --protocol tcp \
  --port 22 \
  --cidr YOUR-IP/32
```

### 2. **Key Pair** (One-Time)
```bash
aws ec2 create-key-pair --key-name claude-dev-key \
  --query 'KeyMaterial' --output text > claude-dev-key.pem
chmod 400 claude-dev-key.pem
```

---

## COST OPTIMIZATION TRICKS

### 1. **Use Spot Instances** (90% savings)
```bash
# Add to launch template for massive savings
"InstanceMarketOptions": {
  "MarketType": "spot",
  "SpotOptions": {"MaxPrice": "0.05"}
}
```

### 2. **Auto-Stop During Off Hours**
```bash
# Cron job to stop instances at night
0 22 * * * aws ec2 stop-instances --instance-ids $(aws ec2 describe-instances --filters "Name=tag:Project,Values=claude-dev" --query 'Reservations[].Instances[?State.Name==`running`].InstanceId' --output text)

# Start them in the morning  
0 8 * * * aws ec2 start-instances --instance-ids $(aws ec2 describe-instances --filters "Name=tag:Project,Values=claude-dev" --query 'Reservations[].Instances[?State.Name==`stopped`].InstanceId' --output text)
```

---

## SUCCESS METRICS

✅ **15 minutes:** First VM running with Claude Code  
✅ **30 minutes:** 5 VMs running from template  
✅ **1 hour:** Automated start/stop schedule  
✅ **Long-term:** Spot instances saving 90% on compute

## Next Level Scaling

- **ECS/EKS:** Container orchestration when you hit 20+ environments
- **Auto Scaling Groups:** Automatic scaling based on demand  
- **Terraform:** Infrastructure as code for complex setups

But start with the manual approach above - it'll serve you well for months and teach you the fundamentals.