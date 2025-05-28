#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';
import { buildExecutiveContext } from '../src/orchestration/executive_context_builder.js';
import { buildLandingPagesManagerContract, buildCartCheckoutManagerContract } from '../src/scope_contract_builder.js';
import fs from 'fs/promises';
import path from 'path';

async function spawnWebsiteExecutiveWithScopeContracts() {
    const manager = new InstanceManager('./state');
    
    // Clean up any existing instances
    const instances = await manager.listInstances();
    for (const instance of instances) {
        await manager.terminateInstance(instance.instanceId);
    }
    
    console.log('🚀 Spawning Website Executive with Scope Contract Architecture...');
    
    // Define project requirements with scope contract guidance
    const projectRequirements = `Build an e-commerce website frontend for selling AI-powered agents.

## 📍 Requirements Location
The complete requirements are in: ../tests/e2e/website_e2e.md
**ACTION**: Use this command to read it: Read("../tests/e2e/website_e2e.md")

## 🎯 Scope Contract Architecture (CRITICAL for preventing manager scope creep)
This project will have 2 managers working in parallel:
- Manager 1: Landing & Product Pages (index.html, products.html, product-detail.html)
- Manager 2: Cart & Checkout Pages (cart.html, checkout.html)

**MANDATORY**: Use explicit scope contracts when spawning managers to prevent scope creep.

## Key Requirements Summary
- 5 HTML pages total: index, products, product-detail, cart, checkout
- Vanilla HTML/CSS/JS only - NO frameworks, NO npm, NO build tools
- Shopping cart with localStorage persistence
- Professional modern design
- All files in single directory

## Your Workflow with Scope Contracts
1. Read the full requirements file first
2. Create DESIGN_SYSTEM.md in your directory
3. Spawn Manager 1 with EXPLICIT scope contract (only their 3 pages)
4. Spawn Manager 2 with EXPLICIT scope contract (only their 2 pages)
5. Send design system and technology requirements to each manager
6. Monitor implementation progress within scope boundaries
7. Test complete integration

## Sample Scope Contract Format:
Manager 1 Context should include:
✅ YOUR SCOPE: index.html, products.html, product-detail.html
❌ NOT YOUR SCOPE: cart.html, checkout.html (Manager 2's responsibility)

This prevents Manager 1 from implementing all 5 pages.`;

    // Generate instance ID and determine working directory
    const instanceId = `exec_${Date.now()}`;
    const workDir = path.join(process.cwd(), instanceId);
    
    // Build context-aware instructions using the context builder
    const context = buildExecutiveContext(projectRequirements, instanceId, workDir);
    
    // Add scope contract examples to the context
    const projectOverview = `The complete e-commerce website has 5 pages total:
- index.html (Landing Page) 
- products.html (Product Catalog)
- product-detail.html (Product Details)
- cart.html (Shopping Cart)
- checkout.html (Checkout)

This project is managed by 2 managers working in parallel.`;

    const manager1Contract = buildLandingPagesManagerContract('mgr_example', projectOverview);
    const manager2Contract = buildCartCheckoutManagerContract('mgr_example2', projectOverview);
    
    const enhancedContext = context + `

## 📋 SCOPE CONTRACT EXAMPLES (Use These When Spawning Managers)

### Manager 1 Scope Contract Example:
${manager1Contract}

### Manager 2 Scope Contract Example:  
${manager2Contract}

**IMPLEMENTATION**: When spawning managers, include their specific scope contract in the context to prevent them from working outside their assigned scope.`;
    
    // Spawn the executive with enhanced context including scope contracts
    const result = await manager.spawnInstance(
        'executive',
        process.cwd(),
        enhancedContext,
        null
    );
    
    console.log(`✅ Executive spawned with Scope Contract Architecture: ${result.instanceId}`);
    console.log(`📁 Working directory: ${result.projectDir || workDir}`);
    console.log(`🖥️  Tmux session: ${result.sessionName}`);
    
    // Give Claude time to initialize
    console.log('\n⏳ Waiting for Claude to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Send a reminder about scope contracts
    console.log('\n📤 Sending scope contract reminder...');
    await manager.sendToInstance(result.instanceId, 
        'Remember: Use explicit scope contracts when spawning managers to prevent scope creep. Manager 1 gets only their 3 pages, Manager 2 gets only their 2 pages. Start by reading: Read("../tests/e2e/website_e2e.md")'
    );
    
    console.log(`
✅ Executive is ready with Scope Contract Architecture!

Key Improvements:
- 🎯 Explicit scope contracts prevent manager scope creep
- 📋 Legal-style boundaries within global context  
- 🔒 Clear "you do this, not that" definitions
- 🤝 Proper coordination interfaces between managers

To monitor:
- tmux attach -t ${result.sessionName}
- node scripts/monitor_executive.js

The executive will now create proper scope boundaries for each manager!
`);
}

spawnWebsiteExecutiveWithScopeContracts().catch(console.error);