#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

async function testIntegration() {
    console.log('🧪 Starting Integration Testing...\n');
    
    const pages = ['index.html', 'products.html', 'product-detail.html', 'cart.html', 'checkout.html'];
    const errors = [];
    const warnings = [];
    
    // Test 1: Check all pages exist
    console.log('✓ Test 1: Verifying all pages exist...');
    for (const page of pages) {
        try {
            await fs.access(page);
            console.log(`  ✅ ${page} exists`);
        } catch {
            errors.push(`Missing page: ${page}`);
            console.log(`  ❌ ${page} missing`);
        }
    }
    
    // Test 2: Check navigation consistency
    console.log('\n✓ Test 2: Checking navigation consistency...');
    const navPattern = /<nav class="navbar"[\s\S]*?<\/nav>/;
    let navHTML = null;
    
    for (const page of pages) {
        try {
            const content = await fs.readFile(page, 'utf-8');
            const match = content.match(navPattern);
            
            if (!match) {
                errors.push(`${page}: No navigation found`);
                continue;
            }
            
            if (!navHTML) {
                navHTML = match[0];
                console.log(`  ✅ ${page} has navigation`);
            } else {
                // Check if navigation is identical
                if (match[0].replace(/\s+/g, ' ').trim() === navHTML.replace(/\s+/g, ' ').trim()) {
                    console.log(`  ✅ ${page} navigation matches`);
                } else {
                    warnings.push(`${page}: Navigation differs from other pages`);
                    console.log(`  ⚠️  ${page} navigation differs`);
                }
            }
        } catch (e) {
            console.log(`  ⚠️  Could not read ${page}`);
        }
    }
    
    // Test 3: Check for required links
    console.log('\n✓ Test 3: Verifying navigation links...');
    const requiredLinks = [
        { href: 'index.html', text: 'Home' },
        { href: 'products.html', text: 'Products' },
        { href: 'cart.html', text: 'Cart' }
    ];
    
    if (navHTML) {
        for (const link of requiredLinks) {
            if (navHTML.includes(`href="${link.href}"`)) {
                console.log(`  ✅ Link to ${link.href} found`);
            } else {
                errors.push(`Navigation missing link to ${link.href}`);
                console.log(`  ❌ Link to ${link.href} missing`);
            }
        }
    }
    
    // Test 4: Check for cart functionality
    console.log('\n✓ Test 4: Checking cart functionality...');
    for (const page of pages) {
        try {
            const content = await fs.readFile(page, 'utf-8');
            
            // Check for cart count element
            if (content.includes('id="cartCount"')) {
                console.log(`  ✅ ${page} has cart count element`);
            } else {
                warnings.push(`${page}: Missing cart count element`);
                console.log(`  ⚠️  ${page} missing cart count`);
            }
            
            // Check for updateCartCount function
            if (content.includes('updateCartCount')) {
                console.log(`  ✅ ${page} has cart update function`);
            } else {
                warnings.push(`${page}: Missing updateCartCount function`);
                console.log(`  ⚠️  ${page} missing cart update function`);
            }
        } catch (e) {
            console.log(`  ⚠️  Could not check ${page}`);
        }
    }
    
    // Test 5: Check CSS consistency
    console.log('\n✓ Test 5: Checking CSS variables...');
    const cssVars = ['--primary-color', '--secondary-color', '--background', '--text-primary'];
    
    for (const page of pages) {
        try {
            const content = await fs.readFile(page, 'utf-8');
            const hasCSSVars = cssVars.every(v => content.includes(v));
            
            if (hasCSSVars) {
                console.log(`  ✅ ${page} has all CSS variables`);
            } else {
                warnings.push(`${page}: Missing some CSS variables`);
                console.log(`  ⚠️  ${page} missing some CSS variables`);
            }
        } catch (e) {
            console.log(`  ⚠️  Could not check ${page}`);
        }
    }
    
    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);
    
    if (errors.length > 0) {
        console.log('\n❌ Errors found:');
        errors.forEach(e => console.log(`  - ${e}`));
    }
    
    if (warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        warnings.forEach(w => console.log(`  - ${w}`));
    }
    
    if (errors.length === 0) {
        console.log('\n✅ All critical tests passed! The website is ready for use.');
    }
}

testIntegration().catch(console.error);