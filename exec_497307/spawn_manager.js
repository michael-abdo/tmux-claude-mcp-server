#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';

async function spawnManager() {
    const manager = new InstanceManager('../state');
    
    console.log('🚀 Spawning Manager 1 for Landing and Product Pages...');
    
    // Read DESIGN_SYSTEM.md content
    const fs = await import('fs/promises');
    const designSystem = await fs.readFile('./DESIGN_SYSTEM.md', 'utf-8');
    
    // Create the context for Manager 1
    const context = `You are Manager 1 responsible for creating the Landing Page and Product Pages (index.html, products.html, product-detail.html) for an e-commerce website selling AI-powered agents.

CRITICAL INSTRUCTIONS:
1. Read the DESIGN_SYSTEM.md provided below and follow it EXACTLY
2. Use ONLY vanilla HTML, CSS, and JavaScript - NO frameworks, NO npm, NO build tools
3. All styling must be in <style> tags, all scripts in <script> tags
4. Create professional pages with sample AI agent products like:
   - DataMiner Pro - Automated data analysis agent ($299/mo)
   - CustomerBot 3000 - 24/7 customer service agent ($199/mo)
   - ContentGenius - AI content creation assistant ($149/mo)
   - CodeHelper AI - Programming assistant agent ($249/mo)
   - SalesBoost Agent - Lead qualification and nurturing ($399/mo)
   - ResearchBot Plus - Market research automation ($179/mo)
5. Ensure all navigation links work between pages
6. Implement cart functionality with localStorage
7. Use placeholder images (create colored divs with text)
8. Reply with "READY: Manager 1 for Landing and Product Pages" when you understand

DESIGN SYSTEM TO FOLLOW:
${designSystem}`;

    // Spawn Manager 1 with shared workspace mode
    const result = await manager.spawnInstance(
        'manager',
        process.cwd(),
        context,
        'exec_497307',
        { workspaceMode: 'shared' }
    );
    
    console.log(`✅ Manager 1 spawned: ${result.instanceId}`);
    console.log(`📁 Working directory: ${result.projectDir}`);
    console.log(`🖥️  Tmux session: ${result.sessionName}`);
}

spawnManager().catch(console.error);