#\!/bin/bash
# Test if setting env vars helps MCP initialization
export CLAUDE_CODE_ENTRYPOINT=cli
export CLAUDECODE=1
export TERM=xterm-256color
cd delegation_demo_1748293046671/exec_046672
claude --dangerously-skip-permissions
EOF < /dev/null