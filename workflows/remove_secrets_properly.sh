#!/bin/bash

echo "🔧 Comprehensive secret removal process..."

# Get to repo root
REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo "📍 Working in: $(pwd)"

# Create a list of all workflow_state files to remove
echo "🔍 Finding all workflow_state files in history..."
git log --all --pretty=format: --name-only --diff-filter=A | grep -E "workflow_state.*\.json$" | sort -u > files-to-remove.txt

echo "📋 Files to remove:"
cat files-to-remove.txt

# Use git filter-repo if available, otherwise fall back to filter-branch
if command -v git-filter-repo &> /dev/null; then
    echo "✅ Using git-filter-repo (recommended)..."
    git filter-repo --invert-paths --paths-from-file files-to-remove.txt --force
else
    echo "⚠️  git-filter-repo not found, using filter-branch..."
    export FILTER_BRANCH_SQUELCH_WARNING=1
    
    # Create the filter script
    cat > remove-files.sh << 'EOF'
#!/bin/bash
while IFS= read -r file; do
    git rm --cached --ignore-unmatch "$file"
done < files-to-remove.txt
EOF
    chmod +x remove-files.sh
    
    # Run filter-branch
    git filter-branch --force --index-filter './remove-files.sh' --prune-empty --tag-name-filter cat -- --all
    
    # Clean up
    rm remove-files.sh
fi

# Clean up
rm -f files-to-remove.txt

echo "🧹 Cleaning up refs..."
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

echo "🗑️  Garbage collection..."
git gc --aggressive --prune=now

echo "✅ Secret removal complete!"
echo ""
echo "⚠️  IMPORTANT: You'll need to force push:"
echo "git push --force origin master"