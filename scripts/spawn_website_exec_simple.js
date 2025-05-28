#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';
import { buildExecutiveContext } from '../src/orchestration/executive_context_builder.js';
import fs from 'fs/promises';
import path from 'path';

async function spawnWebsiteExecutive() {
    const manager = new InstanceManager('./state');
    
    // Clean up any existing instances
    const instances = await manager.listInstances();
    for (const instance of instances) {
        await manager.terminateInstance(instance.instanceId);
    }
    
    console.log('🚀 Spawning Website Executive...');
    
    // Define project requirements
    const projectRequirements = `Build an e-commerce website frontend for selling AI-powered agents.

## 📍 Requirements Location
The complete requirements are in: ../tests/e2e/website_e2e.md
**ACTION**: Use this command to read it: Read("../tests/e2e/website_e2e.md")

## Key Requirements Summary
- 5 HTML pages: index, products, product-detail, cart, checkout
- Vanilla HTML/CSS/JS only - NO frameworks, NO npm, NO build tools
- Shopping cart with localStorage persistence
- Professional modern design
- All files in single directory

## Your Workflow
1. Read the full requirements file first
2. Create DESIGN_SYSTEM.md in your directory
3. Spawn 2 managers (one for landing/products, one for cart/checkout)
4. Send design system and technology requirements to each manager
5. Monitor implementation progress
6. Test complete integration`;

    // Generate instance ID and determine working directory
    const instanceId = `exec_${Date.now()}`;
    const workDir = path.join(process.cwd(), instanceId);
    
    // Build context-aware instructions using the context builder
    const context = buildExecutiveContext(projectRequirements, instanceId, workDir);
    
    // Spawn the executive with context-aware instructions
    const result = await manager.spawnInstance(
        'executive',
        process.cwd(),
        context,
        null
    );
    
    console.log(`✅ Executive spawned: ${result.instanceId}`);
    console.log(`📁 Working directory: ${result.projectDir || workDir}`);
    console.log(`🖥️  Tmux session: ${result.sessionName}`);
    
    // Give Claude time to initialize
    console.log('\n⏳ Waiting for Claude to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Send a reminder about the first action
    console.log('\n📤 Sending initial reminder...');
    await manager.sendToInstance(result.instanceId, 
        'Start by running: Read("../tests/e2e/website_e2e.md") to understand the full requirements.'
    );
    
    console.log(`
✅ Executive is ready with context-aware instructions!

To monitor:
- tmux attach -t ${result.sessionName}
- node scripts/monitor_executive.js

The executive has:
- Its exact working directory path
- Copy-paste ready MCP bridge commands
- Clear instructions on file locations

The executive should now be reading requirements and creating DESIGN_SYSTEM.md
`);
}

spawnWebsiteExecutive().catch(console.error);