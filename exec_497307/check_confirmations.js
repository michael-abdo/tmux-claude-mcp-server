#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';

async function checkConfirmations() {
    const manager = new InstanceManager('../state');
    
    console.log('📋 Checking manager confirmations...');
    
    // Send follow-up to Manager 1
    await manager.sendToInstance('mgr_497307_728781', 
        'I see you are already working on the pages. Please confirm you received the technology requirements by saying "CONFIRMED: Vanilla HTML/CSS/JS only". Also, please focus only on index.html, products.html, and product-detail.html. Manager 2 is responsible for cart.html and checkout.html.');
    
    // Send follow-up to Manager 2  
    await manager.sendToInstance('mgr_497307_892242',
        'I see you are already working. Please confirm you received the technology requirements by saying "CONFIRMED: Vanilla HTML/CSS/JS only". Please focus only on cart.html and checkout.html. Manager 1 is handling the other pages.');
    
    console.log('✅ Sent confirmation requests to both managers');
}

checkConfirmations().catch(console.error);