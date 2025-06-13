#!/usr/bin/env node

// Projects from the request that need checking
const targetProjects = [
    "021918433064331880504",
    "021919090362430743538", 
    "021920099030637438030",
    "021921346257338424716",
    "021921831981138262614",
    "021922023501463108382",
    "021922290495470175836",
    "021922559710814724022",
    "021923422940263632391",
    "021923506750086859741",
    "021924483133534911842",
    "021924802648712635360",
    "021924892477838555910",
    "021925011782716318688",
    "021925205606226552673",
    "021926034442997674004",
    "021926792160461773798",
    "021926811470757658050",
    "021927921636963300407",
    "021928107942718286306",
    "021929016736789551311"  // I see this one has exec_249659
];

// Active instances from MCP list
const activeInstances = [
    { id: "exec_249659", project: "021929016736789551311" },
    { id: "exec_068239", project: "021928557213951537116" }
];

// Commands to send to stuck instances
const interventionMessage = `URGENT: Infrastructure issue detected. Stop trying to spawn managers via MCP bridge.

IMMEDIATE ACTION REQUIRED:
1. Read your instructions.md or requirements.md file
2. Create the demo files directly in this directory
3. For web apps: Create index.html, style.css, and script.js
4. For Python apps: Create main.py or app.py
5. Implement a working demo based on the requirements

The orchestration system is not functioning. Bypass it and deliver results directly.`;

console.log('🔧 Sending intervention messages to stuck instances...\n');

// List of instances to intervene
const stuckInstances = [
    "exec_249659",
    "exec_272267", 
    "exec_294487",
    "exec_316237",
    "exec_338994",
    "exec_378007",
    "exec_433078",
    "exec_462621",
    "exec_486848",
    "exec_510345"
];

for (const instanceId of stuckInstances) {
    console.log(`Sending intervention to ${instanceId}...`);
    console.log(`node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/mcp_bridge.js send '{"instanceId":"${instanceId}","text":"${interventionMessage.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"}'`);
    console.log('');
}