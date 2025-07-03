# VM GitHub Workflow Requirements

## Analysis from Successful claude-vm-test Workflow

This document captures the exact requirements discovered through the successful end-to-end workflow test.

## Critical Success Factors

### 🔑 **SSH Authentication Requirements**

1. **SSH Key Format**: Must use ed25519
   ```bash
   ssh-keygen -t ed25519 -C 'project-name' -f ~/.ssh/id_ed25519 -N ''
   ```

2. **Deploy Key Permissions**: MUST have write access
   ```bash
   gh repo deploy-key add key.pub --title "VM Key" --allow-write --repo OWNER/REPO
   ```
   ⚠️ **Critical**: Default deploy keys are read-only and will cause push failure

3. **SSH Known Hosts**: GitHub must be added to prevent host verification errors
   ```bash
   ssh-keyscan github.com >> ~/.ssh/known_hosts
   ```

4. **Remote URL Format**: Must use SSH format, not HTTPS
   ```bash
   git remote set-url origin git@github.com:OWNER/REPO.git
   ```

### 🔧 **VM Prerequisites**

1. **Operating System**: Ubuntu 22.04.5 LTS (tested and verified)
2. **Node.js**: v20.19.2+ (for Claude Code)
3. **npm**: 10.8.2+ (for Claude Code installation)
4. **Python**: 3.10.12+ (dependency)
5. **git**: Latest version
6. **Claude Code**: v1.0.24 installed via `sudo npm install -g @anthropic-ai/claude-code`

### 🌐 **Local Machine Requirements**

1. **GitHub CLI**: Authenticated with write access
2. **GCP CLI**: Authenticated and configured
3. **MCP Bridge**: Operational for Claude instance orchestration
4. **VM Integration Scripts**: Available in setup-scripts/

### 📝 **Git Configuration**

1. **User Settings**: Required on VM
   ```bash
   git config user.name "Name"
   git config user.email "email@example.com"
   ```

2. **Repository Initialization**: Clone with SSH URL
   ```bash
   git clone git@github.com:OWNER/REPO.git
   ```

## Proven Installation Commands

### Claude Code Installation
```bash
# On VM
sudo npm install -g @anthropic-ai/claude-code
sudo ln -sf /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js /usr/local/bin/claude-code
```

### SSH Key Setup
```bash
# Generate key
ssh-keygen -t ed25519 -C 'project-vm-key' -f ~/.ssh/id_ed25519 -N ''

# Add GitHub to known hosts
ssh-keyscan github.com >> ~/.ssh/known_hosts

# Extract public key
cat ~/.ssh/id_ed25519.pub
```

### GitHub Deploy Key
```bash
# Local machine - add with write permissions
gh repo deploy-key add key.pub --title "VM SSH Key" --allow-write --repo OWNER/REPO
```

## Common Failure Points

### ❌ **Authentication Failures**

1. **"ERROR: The key you are authenticating with has been marked as read only"**
   - **Cause**: Deploy key added without `--allow-write` flag
   - **Solution**: Delete and re-add key with write permissions

2. **"Host key verification failed"**
   - **Cause**: GitHub not in SSH known_hosts
   - **Solution**: `ssh-keyscan github.com >> ~/.ssh/known_hosts`

3. **"fatal: could not read Username for 'https://github.com'"**
   - **Cause**: Using HTTPS URL instead of SSH
   - **Solution**: Change remote to SSH format

### ❌ **Installation Failures**

1. **"claude-code: command not found"**
   - **Cause**: Symlink not created or wrong path
   - **Solution**: Create symlink to `/usr/local/bin/claude-code`

2. **"@anthropic/claude-code not found"**
   - **Cause**: Wrong package name
   - **Solution**: Use correct package `@anthropic-ai/claude-code`

## Verification Steps

### ✅ **Claude Code Installation**
```bash
claude-code --version  # Should return "1.0.24 (Claude Code)"
```

### ✅ **SSH Authentication**
```bash
ssh -T git@github.com  # Should authenticate successfully
```

### ✅ **Git Push Test**
```bash
git push origin main  # Should succeed without errors
```

## Complete Workflow Summary

1. **VM Setup**: Create VM with Ubuntu 22.04.5 LTS
2. **Claude Code**: Install via npm with symlink
3. **GitHub Repo**: Create public repository
4. **SSH Key**: Generate ed25519 key on VM
5. **Deploy Key**: Add to GitHub with write permissions
6. **Known Hosts**: Add GitHub to SSH known_hosts
7. **Git Config**: Set user name/email on VM
8. **Remote URL**: Use SSH format for GitHub
9. **Development**: Create/commit/push files
10. **Verification**: Pull to local tests directory

## Automation Script

Use the complete automation script:
```bash
./setup-scripts/complete-vm-github-workflow.sh [VM_NAME] [ZONE] [REPO_NAME] [DESCRIPTION]
```

This script automates all the requirements discovered through the successful workflow test.