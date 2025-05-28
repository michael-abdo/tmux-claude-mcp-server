#!/usr/bin/env node

import { InstanceManager } from '../src/instance_manager.js';

async function checkCheckout() {
    const manager = new InstanceManager('../state');
    
    console.log('📋 Checking on checkout.html status...');
    
    await manager.sendToInstance('mgr_497307_892242', 
        'I see cart.html has been created. Please also create checkout.html with the billing form, shipping form, order summary, and payment method selection as specified in the requirements. Make sure it follows the DESIGN_SYSTEM.md exactly.');
    
    console.log('✅ Sent checkout page reminder to Manager 2');
}

checkCheckout().catch(console.error);