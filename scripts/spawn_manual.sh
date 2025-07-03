#!/bin/bash

# Manual spawning script to bypass shell issues
export PATH="/usr/local/bin:/usr/bin:/bin"
export SHELL="/bin/bash"

PROJECT_DIR="$1"
if [ -z "$PROJECT_DIR" ]; then
    echo "Usage: $0 <project_directory>"
    exit 1
fi

echo "Spawning executive for project: $PROJECT_DIR"

cd "$(dirname "$0")"
node scripts/api/spawn_project_executive.js \
    --project-dir "$PROJECT_DIR" \
    --project-type "web-app" \
    --requirements-file "instructions.md" \
    --json

echo "Spawn attempt completed"