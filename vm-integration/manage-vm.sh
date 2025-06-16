#!/bin/bash

# Simple VM Management Script for Claude Code VMs
# Usage: ./manage-vm.sh [command] [vm-name]

set -e

COMMAND="${1:-help}"
VM_NAME="${2:-}"
ZONE="${GCP_ZONE:-us-central1-a}"
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

usage() {
    echo "🤖 Claude Code VM Manager"
    echo ""
    echo "Usage: $0 [command] [vm-name]"
    echo ""
    echo "Commands:"
    echo "  list                 List all Claude VMs"
    echo "  create              Create a new VM (uses simple-gcp-vm.sh)"
    echo "  start <vm-name>     Start a stopped VM"
    echo "  stop <vm-name>      Stop a running VM"
    echo "  delete <vm-name>    Delete a VM permanently"
    echo "  ssh <vm-name>       Connect to VM via SSH"
    echo "  status <vm-name>    Show VM status"
    echo "  ip <vm-name>        Get VM IP address"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 create"
    echo "  $0 start my-claude-vm"
    echo "  $0 ssh my-claude-vm"
    echo ""
}

list_vms() {
    echo "🔍 Listing Claude Code VMs..."
    echo ""
    
    VMS=$(gcloud compute instances list --filter="labels.type=claude-dev" --format="table(name,status,machineType.scope(machineTypes),zone.scope(zones),networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IP)" 2>/dev/null || true)
    
    if [ -z "$VMS" ] || [ $(echo "$VMS" | wc -l) -le 1 ]; then
        echo "📋 No Claude Code VMs found"
        echo ""
        echo "💡 Create your first VM:"
        echo "   $0 create"
        return
    fi
    
    echo "$VMS"
    echo ""
    
    TOTAL=$(echo "$VMS" | tail -n +2 | wc -l | tr -d ' ')
    RUNNING=$(echo "$VMS" | grep -c "RUNNING" || echo "0")
    STOPPED=$(echo "$VMS" | grep -c "TERMINATED" || echo "0")
    
    echo "📊 Summary: $TOTAL total, $RUNNING running, $STOPPED stopped"
    echo ""
}

create_vm() {
    echo "🚀 Creating new Claude Code VM..."
    
    if [ ! -f "$(dirname "$0")/simple-gcp-vm.sh" ]; then
        echo -e "${RED}❌ Error: simple-gcp-vm.sh not found${NC}"
        echo "Make sure you're running this from the vm-integration directory"
        exit 1
    fi
    
    bash "$(dirname "$0")/simple-gcp-vm.sh"
}

start_vm() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 start <vm-name>"
        exit 1
    fi
    
    echo "▶️  Starting VM: $VM_NAME"
    gcloud compute instances start "$VM_NAME" --zone="$ZONE" --quiet
    
    # Wait a moment for IP assignment
    sleep 10
    
    VM_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "pending")
    
    echo -e "${GREEN}✅ VM started successfully!${NC}"
    echo "🌐 IP: $VM_IP"
    echo "🔗 SSH: gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
}

stop_vm() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 stop <vm-name>"
        exit 1
    fi
    
    echo "⏸️  Stopping VM: $VM_NAME"
    gcloud compute instances stop "$VM_NAME" --zone="$ZONE" --quiet
    
    echo -e "${GREEN}✅ VM stopped successfully!${NC}"
    echo "💰 This saves compute costs while preserving your data"
    echo "🔄 Start again with: $0 start $VM_NAME"
}

delete_vm() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 delete <vm-name>"
        exit 1
    fi
    
    echo -e "${YELLOW}⚠️  WARNING: This will permanently delete VM '$VM_NAME'${NC}"
    echo "All data on the VM will be lost forever!"
    echo ""
    read -p "Type 'yes' to confirm deletion: " CONFIRM
    
    if [ "$CONFIRM" != "yes" ]; then
        echo "Deletion cancelled"
        exit 0
    fi
    
    echo "🗑️  Deleting VM: $VM_NAME"
    gcloud compute instances delete "$VM_NAME" --zone="$ZONE" --quiet
    
    echo -e "${GREEN}✅ VM deleted successfully!${NC}"
}

ssh_vm() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 ssh <vm-name>"
        exit 1
    fi
    
    echo "🔗 Connecting to VM: $VM_NAME"
    gcloud compute ssh ubuntu@"$VM_NAME" --zone="$ZONE"
}

status_vm() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 status <vm-name>"
        exit 1
    fi
    
    echo "📊 VM Status: $VM_NAME"
    echo "═══════════════════════"
    
    STATUS=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(status)" 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$STATUS" = "NOT_FOUND" ]; then
        echo -e "${RED}❌ VM not found${NC}"
        exit 1
    fi
    
    VM_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "none")
    MACHINE_TYPE=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(machineType.scope(machineTypes))" 2>/dev/null || echo "unknown")
    CREATED=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(creationTimestamp)" 2>/dev/null || echo "unknown")
    
    case $STATUS in
        "RUNNING")
            STATUS_ICON="🟢"
            STATUS_COLOR="$GREEN"
            ;;
        "TERMINATED")
            STATUS_ICON="🔴"
            STATUS_COLOR="$YELLOW"
            ;;
        *)
            STATUS_ICON="🟡"
            STATUS_COLOR="$BLUE"
            ;;
    esac
    
    echo -e "Status: $STATUS_ICON ${STATUS_COLOR}$STATUS${NC}"
    echo "Machine Type: $MACHINE_TYPE"
    echo "External IP: $VM_IP"
    echo "Zone: $ZONE"
    echo "Created: $CREATED"
    
    if [ "$STATUS" = "RUNNING" ] && [ "$VM_IP" != "none" ]; then
        echo ""
        echo "🔗 SSH Command:"
        echo "   gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
    fi
}

get_ip() {
    if [ -z "$VM_NAME" ]; then
        echo -e "${RED}❌ VM name required${NC}"
        echo "Usage: $0 ip <vm-name>"
        exit 1
    fi
    
    VM_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)" 2>/dev/null || echo "")
    
    if [ -z "$VM_IP" ]; then
        echo -e "${RED}❌ Could not get IP for VM: $VM_NAME${NC}"
        exit 1
    fi
    
    echo "$VM_IP"
}

# Main command routing
case $COMMAND in
    "list")
        list_vms
        ;;
    "create")
        create_vm
        ;;
    "start")
        start_vm
        ;;
    "stop")
        stop_vm
        ;;
    "delete")
        delete_vm
        ;;
    "ssh")
        ssh_vm
        ;;
    "status")
        status_vm
        ;;
    "ip")
        get_ip
        ;;
    "help"|"-h"|"--help"|*)
        usage
        ;;
esac