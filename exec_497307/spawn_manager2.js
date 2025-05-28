#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';

async function spawnManager2() {
    const manager = new InstanceManager('../state');
    
    console.log('🚀 Spawning Manager 2 for Cart and Checkout Pages...');
    
    // Read DESIGN_SYSTEM.md content
    const fs = await import('fs/promises');
    const designSystem = await fs.readFile('./DESIGN_SYSTEM.md', 'utf-8');
    
    // Create the context for Manager 2
    const context = `You are Manager 2 responsible for creating the Cart and Checkout Pages (cart.html, checkout.html) for an e-commerce website selling AI-powered agents.

CRITICAL INSTRUCTIONS:
1. Read the DESIGN_SYSTEM.md provided below and follow it EXACTLY
2. Use ONLY vanilla HTML, CSS, and JavaScript - NO frameworks, NO npm, NO build tools
3. All styling must be in <style> tags, all scripts in <script> tags
4. Create professional cart and checkout pages that:
   - Cart page: Display items from localStorage, quantity controls, remove items, price calculation
   - Checkout page: Billing form, shipping form, order summary, payment method selection (mock)
5. Ensure all navigation links work (especially to products.html and index.html)
6. Implement cart persistence with localStorage
7. Add form validation on checkout page
8. Reply with "READY: Manager 2 for Cart and Checkout Pages" when you understand

DESIGN SYSTEM TO FOLLOW:
${designSystem}`;

    // Spawn Manager 2 with shared workspace mode
    const result = await manager.spawnInstance(
        'manager',
        process.cwd(),
        context,
        'exec_497307',
        { workspaceMode: 'shared' }
    );
    
    console.log(`✅ Manager 2 spawned: ${result.instanceId}`);
    console.log(`📁 Working directory: ${result.projectDir}`);
    console.log(`🖥️  Tmux session: ${result.sessionName}`);
}

spawnManager2().catch(console.error);