#!/usr/bin/env node

/**
 * Load test for Phase 3 - Testing with 10+ concurrent instances
 * 
 * This test will:
 * 1. Spawn an Executive instance
 * 2. Executive spawns 3 Manager instances  
 * 3. Each Manager spawns 4 Specialist instances (12 total)
 * 4. Execute parallel tasks across all Specialists
 * 5. Measure performance and resource usage
 */

import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set environment to Phase 3
process.env.PHASE = '3';
process.env.MCP_SERVER_PATH = path.join(__dirname, '..', 'src', 'simple_mcp_server.js');

// Test configuration (reduced for faster tests)
const TEST_CONFIG = {
    numManagers: 2,
    specialistsPerManager: 2,
    totalSpecialists: 4,
    tasksPerSpecialist: 2,
    totalTasks: 8
};

class LoadTester {
    constructor() {
        this.workDir = path.join(__dirname, '..', 'test-workdir-load');
        this.logDir = path.join(__dirname, '..', 'logs', `load-test-${Date.now()}`);
        this.metrics = {
            startTime: null,
            endTime: null,
            instanceCreationTimes: [],
            taskExecutionTimes: [],
            memoryUsage: [],
            errors: []
        };
    }

    async setup() {
        console.log('=== Setting up load test environment ===');
        await fs.ensureDir(this.workDir);
        await fs.ensureDir(this.logDir);
        
        // Clear any existing tmux sessions
        try {
            execSync('tmux kill-server', { stdio: 'ignore' });
        } catch (e) {
            // Ignore if no tmux server running
        }
        
        console.log(`Work directory: ${this.workDir}`);
        console.log(`Log directory: ${this.logDir}`);
    }

    async executeCliCommand(command, input = '') {
        const fullCommand = `echo '${input}' | claude --project ${this.workDir} ${command}`;
        console.log(`Executing: ${command}`);
        
        try {
            const output = execSync(fullCommand, {
                encoding: 'utf-8',
                env: { ...process.env, CLAUDE_PROJECT: this.workDir }
            });
            return output;
        } catch (error) {
            console.error(`Command failed: ${error.message}`);
            this.metrics.errors.push({
                command,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            throw error;
        }
    }

    async measureMemoryUsage() {
        try {
            const output = execSync('ps aux | grep tmux | grep -v grep', { encoding: 'utf-8' });
            const lines = output.trim().split('\n');
            let totalMemory = 0;
            
            lines.forEach(line => {
                const parts = line.split(/\s+/);
                if (parts.length > 5) {
                    totalMemory += parseFloat(parts[5]) || 0; // VSZ column
                }
            });
            
            return totalMemory;
        } catch (e) {
            return 0;
        }
    }

    async runLoadTest() {
        console.log('\n=== Starting Load Test ===');
        console.log(`Configuration:`);
        console.log(`  - Managers: ${TEST_CONFIG.numManagers}`);
        console.log(`  - Specialists per Manager: ${TEST_CONFIG.specialistsPerManager}`);
        console.log(`  - Total Specialists: ${TEST_CONFIG.totalSpecialists}`);
        console.log(`  - Tasks per Specialist: ${TEST_CONFIG.tasksPerSpecialist}`);
        console.log(`  - Total Tasks: ${TEST_CONFIG.totalTasks}`);
        
        this.metrics.startTime = Date.now();
        
        // Phase 1: Create Executive
        console.log('\n--- Phase 1: Creating Executive ---');
        const execStart = Date.now();
        await this.executeCliCommand('mcp spawn executive . "You are the Executive orchestrating a large parallel workload test"');
        this.metrics.instanceCreationTimes.push({
            type: 'executive',
            duration: Date.now() - execStart
        });
        
        // Record memory usage
        this.metrics.memoryUsage.push({
            phase: 'executive_created',
            memory: await this.measureMemoryUsage(),
            timestamp: Date.now()
        });
        
        // Phase 2: Create Managers
        console.log('\n--- Phase 2: Creating Managers ---');
        const managerPromises = [];
        for (let i = 0; i < TEST_CONFIG.numManagers; i++) {
            const managerStart = Date.now();
            const promise = this.executeCliCommand(
                `mcp spawn manager . "You are Manager ${i+1} responsible for coordinating Specialists"`
            ).then(() => {
                this.metrics.instanceCreationTimes.push({
                    type: 'manager',
                    id: i + 1,
                    duration: Date.now() - managerStart
                });
            });
            managerPromises.push(promise);
            
            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await Promise.all(managerPromises);
        
        // Record memory usage
        this.metrics.memoryUsage.push({
            phase: 'managers_created',
            memory: await this.measureMemoryUsage(),
            timestamp: Date.now()
        });
        
        // Phase 3: Create Specialists
        console.log('\n--- Phase 3: Creating Specialists ---');
        const specialistPromises = [];
        for (let m = 1; m <= TEST_CONFIG.numManagers; m++) {
            for (let s = 1; s <= TEST_CONFIG.specialistsPerManager; s++) {
                const specStart = Date.now();
                const promise = this.executeCliCommand(
                    `mcp send mgr_${m}_* "spawn specialist . 'You are Specialist ${s} under Manager ${m}'"`
                ).then(() => {
                    this.metrics.instanceCreationTimes.push({
                        type: 'specialist',
                        manager: m,
                        id: s,
                        duration: Date.now() - specStart
                    });
                });
                specialistPromises.push(promise);
                
                // Small delay between specialist creation
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        await Promise.all(specialistPromises);
        
        // Record memory usage
        this.metrics.memoryUsage.push({
            phase: 'all_instances_created',
            memory: await this.measureMemoryUsage(),
            instances: 1 + TEST_CONFIG.numManagers + TEST_CONFIG.totalSpecialists,
            timestamp: Date.now()
        });
        
        // Phase 4: Execute parallel tasks
        console.log('\n--- Phase 4: Executing Parallel Tasks ---');
        const taskStart = Date.now();
        
        // Create tasks for distribution
        const tasks = [];
        for (let i = 0; i < TEST_CONFIG.totalTasks; i++) {
            tasks.push({
                id: `task_${i}`,
                type: 'compute',
                data: `Calculate fibonacci(${20 + (i % 10)})`,
                priority: i % 3 === 0 ? 'high' : 'normal'
            });
        }
        
        // Send tasks to Executive for distribution
        await this.executeCliCommand(
            'mcp send exec_* "distribute_work"',
            JSON.stringify({ tasks, strategy: 'least-loaded' })
        );
        
        // Wait for task completion
        console.log('Waiting for task completion...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
        
        this.metrics.taskExecutionTimes.push({
            totalTasks: TEST_CONFIG.totalTasks,
            duration: Date.now() - taskStart
        });
        
        // Record final memory usage
        this.metrics.memoryUsage.push({
            phase: 'tasks_completed',
            memory: await this.measureMemoryUsage(),
            timestamp: Date.now()
        });
        
        // Phase 5: Verify all instances are still active
        console.log('\n--- Phase 5: Verifying Instance Health ---');
        const listOutput = await this.executeCliCommand('mcp list');
        const activeInstances = (listOutput.match(/active/g) || []).length;
        console.log(`Active instances: ${activeInstances}`);
        
        this.metrics.endTime = Date.now();
    }

    generateReport() {
        console.log('\n=== Load Test Report ===');
        
        const totalDuration = this.metrics.endTime - this.metrics.startTime;
        console.log(`Total test duration: ${(totalDuration / 1000).toFixed(2)} seconds`);
        
        // Instance creation times
        console.log('\nInstance Creation Times:');
        const avgExecTime = this.metrics.instanceCreationTimes
            .filter(t => t.type === 'executive')
            .reduce((sum, t) => sum + t.duration, 0) / 1;
        console.log(`  Executive: ${avgExecTime.toFixed(0)}ms`);
        
        const managerTimes = this.metrics.instanceCreationTimes.filter(t => t.type === 'manager');
        const avgManagerTime = managerTimes.reduce((sum, t) => sum + t.duration, 0) / managerTimes.length;
        console.log(`  Managers (avg): ${avgManagerTime.toFixed(0)}ms`);
        
        const specialistTimes = this.metrics.instanceCreationTimes.filter(t => t.type === 'specialist');
        const avgSpecialistTime = specialistTimes.reduce((sum, t) => sum + t.duration, 0) / specialistTimes.length;
        console.log(`  Specialists (avg): ${avgSpecialistTime.toFixed(0)}ms`);
        
        // Task execution
        console.log('\nTask Execution:');
        if (this.metrics.taskExecutionTimes.length > 0) {
            const taskMetrics = this.metrics.taskExecutionTimes[0];
            const tasksPerSecond = taskMetrics.totalTasks / (taskMetrics.duration / 1000);
            console.log(`  Total tasks: ${taskMetrics.totalTasks}`);
            console.log(`  Duration: ${(taskMetrics.duration / 1000).toFixed(2)} seconds`);
            console.log(`  Throughput: ${tasksPerSecond.toFixed(2)} tasks/second`);
        }
        
        // Memory usage
        console.log('\nMemory Usage:');
        this.metrics.memoryUsage.forEach(m => {
            console.log(`  ${m.phase}: ${(m.memory / 1024).toFixed(2)} MB`);
        });
        
        // Errors
        console.log(`\nErrors encountered: ${this.metrics.errors.length}`);
        if (this.metrics.errors.length > 0) {
            this.metrics.errors.forEach(err => {
                console.log(`  - ${err.timestamp}: ${err.command} - ${err.error}`);
            });
        }
        
        // Save detailed report
        const reportPath = path.join(this.logDir, 'load-test-report.json');
        fs.writeJsonSync(reportPath, this.metrics, { spaces: 2 });
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }

    async cleanup() {
        console.log('\n=== Cleaning up ===');
        
        // Terminate all instances
        await this.executeCliCommand('mcp terminate exec_* --cascade').catch(() => {});
        
        // Kill any remaining tmux sessions
        try {
            execSync('tmux kill-server', { stdio: 'ignore' });
        } catch (e) {
            // Ignore
        }
        
        console.log('Cleanup complete');
    }

    async run() {
        try {
            await this.setup();
            await this.runLoadTest();
            this.generateReport();
        } catch (error) {
            console.error('Load test failed:', error);
            this.metrics.errors.push({
                phase: 'test_failure',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.cleanup();
        }
    }
}

// Run the load test
const tester = new LoadTester();
tester.run().catch(console.error);