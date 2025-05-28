#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';

async function sendRequirements() {
    const manager = new InstanceManager('../state');
    
    console.log('📨 Sending technology requirements to managers...');
    
    const techMessage = `TECHNOLOGY REQUIREMENTS (MANDATORY): Use ONLY vanilla HTML, CSS, and JavaScript. NO frameworks (no React, Vue, Angular). NO build tools (no npm, webpack, vite). NO package.json. All code must work by opening HTML files directly in browser. Please confirm you understand these requirements by replying "CONFIRMED: Vanilla HTML/CSS/JS only".`;
    
    // Send to Manager 1
    await manager.sendToInstance('mgr_497307_728781', techMessage);
    console.log('✅ Sent requirements to Manager 1');
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Send to Manager 2
    await manager.sendToInstance('mgr_497307_892242', techMessage);
    console.log('✅ Sent requirements to Manager 2');
    
    // Wait for responses
    console.log('\n⏳ Waiting for confirmations...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Read responses using tmux capture-pane
    const { execSync } = await import('child_process');
    
    console.log('\n📖 Manager 1 response:');
    try {
        const output1 = execSync(`tmux capture-pane -t claude_mgr_497307_728781:0.0 -p | tail -20`);
        console.log(output1.toString());
    } catch (e) {
        console.log('Could not read Manager 1 output');
    }
    
    console.log('\n📖 Manager 2 response:');
    try {
        const output2 = execSync(`tmux capture-pane -t claude_mgr_497307_892242:0.0 -p | tail -20`);
        console.log(output2.toString());
    } catch (e) {
        console.log('Could not read Manager 2 output');
    }
}

sendRequirements().catch(console.error);