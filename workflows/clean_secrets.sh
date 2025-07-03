#!/bin/bash
# Script to clean secrets from git history

echo "🧹 Cleaning secrets from git history..."

# Set the warning suppression
export FILTER_BRANCH_SQUELCH_WARNING=1

# Navigate to repo root
cd "$(git rev-parse --show-toplevel)"

# Remove workflow_state files from all commits
echo "📝 Removing workflow_state files from history..."
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch workflow_state/*.json workflows/workflow_state/*.json' \
  --prune-empty --tag-name-filter cat -- --all

echo "✅ Git history cleaned!"

# Return to workflows directory
cd workflows

echo "📋 Adding workflow_state/ to .gitignore..."