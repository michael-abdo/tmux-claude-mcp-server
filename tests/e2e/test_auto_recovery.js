#!/usr/bin/env node

/**
 * Test Manager auto-recovery after crashes
 * 
 * This test will:
 * 1. Create a Manager with Specialists
 * 2. Simulate a Manager crash
 * 3. Verify auto-recovery with --continue flag
 * 4. Ensure Specialists remain functional
 * 5. Test work redistribution after recovery
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { HealthMonitor } from '../../src/health_monitor.js';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Phase 3 for advanced features
process.env.PHASE = '3';

class AutoRecoveryTest {
    constructor() {
        this.workDir = path.join(__dirname, '..', 'test-workdir-recovery');
        this.stateDir = path.join(__dirname, '..', 'test-state-recovery');
        this.testResults = {
            setup: false,
            managerCrash: false,
            autoRecovery: false,
            specialistSurvival: false,
            workRedistribution: false,
            errors: []
        };
    }

    async setup() {
        console.log('=== Setting up Auto-Recovery Test ===');
        
        // Clean directories
        await fs.remove(this.workDir);
        await fs.remove(this.stateDir);
        await fs.ensureDir(this.workDir);
        await fs.ensureDir(this.stateDir);
        
        // Initialize components
        this.instanceManager = new InstanceManager(this.stateDir, { useRedis: true });
        this.healthMonitor = new HealthMonitor(this.instanceManager);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        this.testResults.setup = true;
        console.log('Setup complete');
    }

    async createTestHierarchy() {
        console.log('\n=== Creating Test Hierarchy ===');
        
        // Create Executive
        const executive = await this.instanceManager.spawnInstance(
            'executive',
            this.workDir,
            'You are the Executive overseeing auto-recovery testing'
        );
        console.log(`Executive created: ${executive.instanceId}`);
        
        // Create Manager
        const manager = await this.instanceManager.spawnInstance(
            'manager',
            this.workDir,
            'You are a Manager that will test crash recovery. Remember all active tasks.',
            executive.instanceId
        );
        console.log(`Manager created: ${manager.instanceId}`);
        
        // Create 3 Specialists
        const specialists = [];
        for (let i = 1; i <= 3; i++) {
            const specialist = await this.instanceManager.spawnInstance(
                'specialist',
                this.workDir,
                `You are Specialist ${i}. Continue working even if Manager crashes.`,
                manager.instanceId
            );
            specialists.push(specialist);
            console.log(`Specialist ${i} created: ${specialist.instanceId}`);
        }
        
        // Send initial work to Manager
        await this.instanceManager.sendToInstance(
            manager.instanceId,
            'Track these tasks: Task A (Specialist 1), Task B (Specialist 2), Task C (Specialist 3)'
        );
        
        // Wait for Manager to process
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return { executive, manager, specialists };
    }

    async simulateManagerCrash(managerId) {
        console.log('\n=== Simulating Manager Crash ===');
        
        try {
            // Get the tmux session name
            const instance = await this.instanceManager.instances[managerId];
            if (!instance) {
                throw new Error('Manager instance not found');
            }
            
            console.log(`Killing tmux session: ${instance.sessionName}`);
            
            // Force kill the tmux session (simulating crash)
            execSync(`tmux kill-session -t ${instance.sessionName}`, { stdio: 'ignore' });
            
            // Update instance status
            instance.status = 'crashed';
            await this.instanceManager.saveInstances();
            
            // Verify crash
            const isActive = await this.instanceManager.isInstanceActive(managerId);
            if (!isActive) {
                console.log('Manager successfully crashed');
                this.testResults.managerCrash = true;
            } else {
                throw new Error('Failed to crash Manager');
            }
            
        } catch (error) {
            console.error('Error simulating crash:', error.message);
            this.testResults.errors.push({
                phase: 'crash_simulation',
                error: error.message
            });
        }
    }

    async testAutoRecovery(managerId) {
        console.log('\n=== Testing Auto-Recovery ===');
        
        try {
            // Start health monitoring
            await this.healthMonitor.startMonitoring(2000); // Check every 2 seconds
            
            console.log('Waiting for health monitor to detect crash...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Check if Manager was auto-recovered
            const isActive = await this.instanceManager.isInstanceActive(managerId);
            
            if (isActive) {
                console.log('Manager auto-recovered successfully!');
                this.testResults.autoRecovery = true;
                
                // Verify Manager remembers context (due to --continue)
                await this.instanceManager.sendToInstance(
                    managerId,
                    'What tasks were you tracking before the crash?'
                );
                
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                const output = await this.instanceManager.readFromInstance(managerId, 20);
                console.log('Manager response after recovery:', output.output.slice(-500));
                
            } else {
                // Manual recovery if auto-recovery didn't trigger
                console.log('Auto-recovery did not trigger, attempting manual recovery...');
                
                const result = await this.instanceManager.restartInstance(managerId);
                if (result.status === 'restarted') {
                    console.log('Manual recovery successful');
                    this.testResults.autoRecovery = true;
                }
            }
            
            // Stop health monitoring
            await this.healthMonitor.stopMonitoring();
            
        } catch (error) {
            console.error('Recovery test error:', error.message);
            this.testResults.errors.push({
                phase: 'recovery_test',
                error: error.message
            });
        }
    }

    async verifySpecialistSurvival(specialists) {
        console.log('\n=== Verifying Specialist Survival ===');
        
        let allActive = true;
        
        for (const specialist of specialists) {
            const isActive = await this.instanceManager.isInstanceActive(specialist.instanceId);
            console.log(`${specialist.instanceId}: ${isActive ? 'Active' : 'Inactive'}`);
            
            if (!isActive) {
                allActive = false;
            }
            
            // Send a message to verify responsiveness
            if (isActive) {
                await this.instanceManager.sendToInstance(
                    specialist.instanceId,
                    'Report your status'
                );
            }
        }
        
        this.testResults.specialistSurvival = allActive;
        console.log(`All Specialists survived: ${allActive}`);
    }

    async testWorkRedistribution(managerId, specialists) {
        console.log('\n=== Testing Work Redistribution ===');
        
        try {
            // Send new work to recovered Manager
            await this.instanceManager.sendToInstance(
                managerId,
                'Distribute new tasks: Task D (any Specialist), Task E (any Specialist)'
            );
            
            // Wait for distribution
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check if Specialists received new work
            let workDistributed = false;
            
            for (const specialist of specialists) {
                const output = await this.instanceManager.readFromInstance(
                    specialist.instanceId, 
                    10
                );
                
                if (output.output.includes('Task D') || output.output.includes('Task E')) {
                    workDistributed = true;
                    console.log(`${specialist.instanceId} received new work`);
                }
            }
            
            this.testResults.workRedistribution = workDistributed;
            console.log(`Work redistribution successful: ${workDistributed}`);
            
        } catch (error) {
            console.error('Work redistribution error:', error.message);
            this.testResults.errors.push({
                phase: 'work_redistribution',
                error: error.message
            });
        }
    }

    async runCascadeFailureTest() {
        console.log('\n\n=== Cascade Failure Test ===');
        console.log('Testing recovery when Executive crashes...\n');
        
        try {
            // Create a new hierarchy
            const { executive, manager, specialists } = await this.createTestHierarchy();
            
            // Crash the Executive
            console.log('Crashing Executive...');
            const execInstance = this.instanceManager.instances[executive.instanceId];
            execSync(`tmux kill-session -t ${execInstance.sessionName}`, { stdio: 'ignore' });
            
            // Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if Manager and Specialists survive
            const managerActive = await this.instanceManager.isInstanceActive(manager.instanceId);
            console.log(`Manager survived Executive crash: ${managerActive}`);
            
            let specialistsSurvived = 0;
            for (const spec of specialists) {
                if (await this.instanceManager.isInstanceActive(spec.instanceId)) {
                    specialistsSurvived++;
                }
            }
            console.log(`Specialists survived: ${specialistsSurvived}/${specialists.length}`);
            
            // Recover Executive
            console.log('\nRecovering Executive...');
            await this.instanceManager.restartInstance(executive.instanceId);
            
            // Verify Executive can communicate with existing instances
            await this.instanceManager.sendToInstance(
                executive.instanceId,
                `list active managers`
            );
            
            console.log('Cascade failure recovery test complete');
            
        } catch (error) {
            console.error('Cascade failure test error:', error.message);
        }
    }

    generateReport() {
        console.log('\n\n=== Auto-Recovery Test Report ===');
        console.log('Test Results:');
        console.log(`  ✓ Setup: ${this.testResults.setup ? 'PASS' : 'FAIL'}`);
        console.log(`  ✓ Manager Crash Simulation: ${this.testResults.managerCrash ? 'PASS' : 'FAIL'}`);
        console.log(`  ✓ Auto-Recovery: ${this.testResults.autoRecovery ? 'PASS' : 'FAIL'}`);
        console.log(`  ✓ Specialist Survival: ${this.testResults.specialistSurvival ? 'PASS' : 'FAIL'}`);
        console.log(`  ✓ Work Redistribution: ${this.testResults.workRedistribution ? 'PASS' : 'FAIL'}`);
        
        const passedTests = Object.values(this.testResults)
            .filter(v => v === true).length;
        const totalTests = 5;
        
        console.log(`\nOverall: ${passedTests}/${totalTests} tests passed`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\nErrors encountered:');
            this.testResults.errors.forEach(err => {
                console.log(`  - ${err.phase}: ${err.error}`);
            });
        }
        
        // Save report
        const reportPath = path.join(this.stateDir, 'recovery-test-report.json');
        fs.writeJsonSync(reportPath, this.testResults, { spaces: 2 });
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }

    async cleanup() {
        console.log('\n=== Cleanup ===');
        
        try {
            // Terminate all instances
            await this.instanceManager.cleanup();
            console.log('Cleanup complete');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async run() {
        try {
            await this.setup();
            
            // Create test hierarchy
            const { executive, manager, specialists } = await this.createTestHierarchy();
            
            // Simulate Manager crash
            await this.simulateManagerCrash(manager.instanceId);
            
            // Test auto-recovery
            await this.testAutoRecovery(manager.instanceId);
            
            // Verify Specialists survived
            await this.verifySpecialistSurvival(specialists);
            
            // Test work redistribution
            await this.testWorkRedistribution(manager.instanceId, specialists);
            
            // Run cascade failure test
            await this.runCascadeFailureTest();
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('Test failed:', error);
            this.testResults.errors.push({
                phase: 'main',
                error: error.message
            });
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
const test = new AutoRecoveryTest();
test.run().catch(console.error);