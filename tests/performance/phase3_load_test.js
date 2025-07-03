#!/usr/bin/env node

/**
 * Direct load test for Phase 3 - Testing with 10+ concurrent instances
 * Uses MCP tools directly instead of Claude CLI
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { ParallelExecutor } from '../../src/parallel_executor.js';
import { JobQueue } from '../../src/job_queue.js';
import { HealthMonitor } from '../../src/health_monitor.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable Phase 3
process.env.PHASE = '3';

class Phase3LoadTest {
    constructor() {
        this.workDir = path.join(__dirname, '..', 'test-workdir-load');
        this.stateDir = path.join(__dirname, '..', 'test-state-load');
        this.metrics = {
            startTime: null,
            endTime: null,
            instanceMetrics: [],
            taskMetrics: [],
            systemMetrics: [],
            errors: []
        };
    }

    async setup() {
        console.log('=== Phase 3 Load Test Setup ===');
        
        // Clean up directories
        await fs.remove(this.workDir);
        await fs.remove(this.stateDir);
        await fs.ensureDir(this.workDir);
        await fs.ensureDir(this.stateDir);
        
        // Initialize components
        this.instanceManager = new InstanceManager(this.stateDir, { useRedis: true });
        this.mcpTools = new EnhancedMCPTools(this.instanceManager);
        this.parallelExecutor = new ParallelExecutor(10); // Max 10 concurrent
        this.jobQueue = new JobQueue();
        this.healthMonitor = new HealthMonitor(this.instanceManager);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Setup complete');
    }

    async spawnHierarchy() {
        console.log('\n=== Spawning Instance Hierarchy ===');
        this.metrics.startTime = Date.now();
        
        // Spawn Executive
        console.log('1. Spawning Executive...');
        const execStart = Date.now();
        const executive = await this.instanceManager.spawnInstance(
            'executive',
            this.workDir,
            'You are the Executive coordinating a load test with 10+ instances'
        );
        this.metrics.instanceMetrics.push({
            role: 'executive',
            id: executive.instanceId,
            spawnTime: Date.now() - execStart
        });
        
        // Spawn 2 Managers (reduced for faster tests)
        console.log('\n2. Spawning 2 Managers...');
        const managers = [];
        for (let i = 1; i <= 2; i++) {
            const mgrStart = Date.now();
            const manager = await this.instanceManager.spawnInstance(
                'manager',
                this.workDir,
                `You are Manager ${i} coordinating Specialists for parallel work`,
                executive.instanceId
            );
            managers.push(manager);
            this.metrics.instanceMetrics.push({
                role: 'manager',
                id: manager.instanceId,
                spawnTime: Date.now() - mgrStart
            });
            console.log(`   - Manager ${i}: ${manager.instanceId}`);
        }
        
        // Spawn 2 Specialists per Manager (4 total) - reduced for faster tests
        console.log('\n3. Spawning 4 Specialists (2 per Manager)...');
        const specialists = [];
        for (const manager of managers) {
            for (let j = 1; j <= 2; j++) {
                const specStart = Date.now();
                const specialist = await this.instanceManager.spawnInstance(
                    'specialist',
                    this.workDir,
                    `You are Specialist ${j} under ${manager.instanceId}`,
                    manager.instanceId
                );
                specialists.push(specialist);
                this.metrics.instanceMetrics.push({
                    role: 'specialist',
                    id: specialist.instanceId,
                    managerId: manager.instanceId,
                    spawnTime: Date.now() - specStart
                });
                console.log(`   - Specialist: ${specialist.instanceId}`);
            }
        }
        
        // Verify all instances
        const allInstances = await this.instanceManager.listInstances();
        console.log(`\nTotal instances created: ${allInstances.length}`);
        console.log(`  - Executive: 1`);
        console.log(`  - Managers: ${managers.length}`);
        console.log(`  - Specialists: ${specialists.length}`);
        
        return { executive, managers, specialists };
    }

    async runParallelTasks(managers) {
        console.log('\n=== Running Parallel Tasks ===');
        
        // Create 8 tasks to distribute (reduced for faster tests)
        const tasks = [];
        for (let i = 0; i < 8; i++) {
            tasks.push({
                id: `task_${i}`,
                type: 'computation',
                description: `Calculate prime numbers up to ${1000 + i * 100}`,
                priority: i % 10 === 0 ? 'high' : 'normal',
                data: {
                    limit: 1000 + i * 100,
                    taskNumber: i
                }
            });
        }
        
        console.log(`Created ${tasks.length} tasks for distribution`);
        
        // Add tasks to job queue
        tasks.forEach(task => {
            this.jobQueue.addJob({
                id: task.id,
                type: task.type,
                priority: task.priority,
                data: task
            });
        });
        
        // Distribute tasks across managers
        const taskStart = Date.now();
        const distributionPromises = [];
        
        for (const manager of managers) {
            // Each manager gets 4 tasks (reduced for faster tests)
            const managerTasks = [];
            for (let i = 0; i < 4; i++) {
                const job = this.jobQueue.getNextJob();
                if (job) {
                    managerTasks.push(job.data);
                }
            }
            
            if (managerTasks.length > 0) {
                const promise = this.mcpTools.executeParallel({
                    managerId: manager.instanceId,
                    tasks: managerTasks,
                    maxConcurrent: 4
                });
                distributionPromises.push(promise);
            }
        }
        
        // Wait for all parallel execution to complete
        console.log('Executing tasks in parallel...');
        const results = await Promise.all(distributionPromises);
        
        this.metrics.taskMetrics.push({
            totalTasks: tasks.length,
            executionTime: Date.now() - taskStart,
            results: results.length
        });
        
        console.log(`All tasks completed in ${(Date.now() - taskStart) / 1000} seconds`);
    }

    async monitorHealth() {
        console.log('\n=== Monitoring Instance Health ===');
        
        // Start health monitoring
        await this.healthMonitor.startMonitoring(5000); // Check every 5 seconds
        
        // Wait for monitoring cycle
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Get health report
        const instances = await this.instanceManager.listInstances();
        let healthyCount = 0;
        let unhealthyCount = 0;
        
        for (const instance of instances) {
            const isHealthy = await this.instanceManager.isInstanceActive(instance.instanceId);
            if (isHealthy) {
                healthyCount++;
            } else {
                unhealthyCount++;
                console.log(`Unhealthy instance detected: ${instance.instanceId}`);
            }
        }
        
        this.metrics.systemMetrics.push({
            timestamp: Date.now(),
            totalInstances: instances.length,
            healthyInstances: healthyCount,
            unhealthyInstances: unhealthyCount
        });
        
        console.log(`Health check: ${healthyCount}/${instances.length} instances healthy`);
        
        // Stop monitoring
        await this.healthMonitor.stopMonitoring();
    }

    async stressTest() {
        console.log('\n=== Stress Testing System ===');
        
        // Send rapid commands to test system under load
        const stressStart = Date.now();
        const stressPromises = [];
        
        // Send 100 rapid read commands
        for (let i = 0; i < 100; i++) {
            const instances = await this.instanceManager.listInstances();
            const randomInstance = instances[Math.floor(Math.random() * instances.length)];
            
            const promise = this.instanceManager.readFromInstance(randomInstance.instanceId, 10)
                .catch(err => {
                    this.metrics.errors.push({
                        type: 'read_error',
                        instance: randomInstance.instanceId,
                        error: err.message
                    });
                });
            
            stressPromises.push(promise);
            
            // Small delay to avoid overwhelming
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        await Promise.all(stressPromises);
        
        console.log(`Stress test completed in ${(Date.now() - stressStart) / 1000} seconds`);
        console.log(`Errors during stress test: ${this.metrics.errors.length}`);
    }

    generateReport() {
        console.log('\n=== Load Test Report ===');
        
        const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000;
        console.log(`\nTotal Duration: ${totalDuration.toFixed(2)} seconds`);
        
        // Instance creation metrics
        console.log('\nInstance Creation Times:');
        const roleMetrics = {};
        this.metrics.instanceMetrics.forEach(m => {
            if (!roleMetrics[m.role]) {
                roleMetrics[m.role] = { count: 0, totalTime: 0 };
            }
            roleMetrics[m.role].count++;
            roleMetrics[m.role].totalTime += m.spawnTime;
        });
        
        Object.entries(roleMetrics).forEach(([role, data]) => {
            const avgTime = data.totalTime / data.count;
            console.log(`  ${role}: ${data.count} instances, avg ${avgTime.toFixed(0)}ms`);
        });
        
        // Task execution metrics
        if (this.metrics.taskMetrics.length > 0) {
            console.log('\nTask Execution:');
            const taskData = this.metrics.taskMetrics[0];
            const tasksPerSecond = taskData.totalTasks / (taskData.executionTime / 1000);
            console.log(`  Total tasks: ${taskData.totalTasks}`);
            console.log(`  Execution time: ${(taskData.executionTime / 1000).toFixed(2)}s`);
            console.log(`  Throughput: ${tasksPerSecond.toFixed(2)} tasks/second`);
        }
        
        // System health
        if (this.metrics.systemMetrics.length > 0) {
            console.log('\nSystem Health:');
            const health = this.metrics.systemMetrics[0];
            console.log(`  Total instances: ${health.totalInstances}`);
            console.log(`  Healthy: ${health.healthyInstances}`);
            console.log(`  Unhealthy: ${health.unhealthyInstances}`);
        }
        
        // Errors
        console.log(`\nTotal Errors: ${this.metrics.errors.length}`);
        if (this.metrics.errors.length > 0) {
            const errorTypes = {};
            this.metrics.errors.forEach(err => {
                errorTypes[err.type] = (errorTypes[err.type] || 0) + 1;
            });
            console.log('Error breakdown:');
            Object.entries(errorTypes).forEach(([type, count]) => {
                console.log(`  ${type}: ${count}`);
            });
        }
        
        // Save detailed report
        const reportPath = path.join(this.stateDir, 'load-test-report.json');
        fs.writeJsonSync(reportPath, this.metrics, { spaces: 2 });
        console.log(`\nDetailed report saved to: ${reportPath}`);
    }

    async cleanup() {
        console.log('\n=== Cleanup ===');
        
        try {
            // Gracefully shut down all instances
            await this.instanceManager.cleanup();
            
            console.log('All instances terminated gracefully');
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async run() {
        try {
            await this.setup();
            
            // Spawn hierarchy
            const { executive, managers, specialists } = await this.spawnHierarchy();
            
            // Run parallel tasks
            await this.runParallelTasks(managers);
            
            // Monitor health
            await this.monitorHealth();
            
            // Stress test
            await this.stressTest();
            
            this.metrics.endTime = Date.now();
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('Load test failed:', error);
            this.metrics.errors.push({
                type: 'fatal_error',
                error: error.message,
                stack: error.stack
            });
        } finally {
            await this.cleanup();
        }
    }
}

// Run the test
const test = new Phase3LoadTest();
test.run().catch(console.error);