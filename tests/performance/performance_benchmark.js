#!/usr/bin/env node

/**
 * Performance Benchmarking Tools
 * 
 * Compares sequential vs parallel execution performance
 * and provides detailed metrics for optimization
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceBenchmark {
    constructor() {
        this.workDir = path.join(__dirname, '..', 'test-workdir-benchmark');
        this.stateDir = path.join(__dirname, '..', 'test-state-benchmark');
        this.results = {
            sequential: {},
            parallel: {},
            comparison: {}
        };
    }

    async setup() {
        console.log('=== Performance Benchmark Setup ===');
        
        // Clean directories
        await fs.remove(this.workDir);
        await fs.remove(this.stateDir);
        await fs.ensureDir(this.workDir);
        await fs.ensureDir(this.stateDir);
        
        console.log('Setup complete\n');
    }

    /**
     * Create test tasks with varying complexity
     */
    createTestTasks(count) {
        const tasks = [];
        
        for (let i = 0; i < count; i++) {
            const complexity = ['simple', 'medium', 'complex'][i % 3];
            
            tasks.push({
                id: `task_${i}`,
                type: 'compute',
                complexity,
                data: {
                    operation: complexity === 'simple' ? 'string_manipulation' :
                               complexity === 'medium' ? 'data_processing' :
                               'algorithm_implementation',
                    input: this.generateTaskInput(complexity, i)
                }
            });
        }
        
        return tasks;
    }

    generateTaskInput(complexity, index) {
        switch (complexity) {
            case 'simple':
                return {
                    text: `Process string ${index}`,
                    operations: ['uppercase', 'reverse', 'hash']
                };
            case 'medium':
                return {
                    array: Array.from({ length: 100 }, (_, i) => i + index),
                    operations: ['sort', 'filter_primes', 'calculate_stats']
                };
            case 'complex':
                return {
                    dataset: Array.from({ length: 1000 }, (_, i) => ({
                        id: i,
                        value: Math.random() * 1000,
                        category: ['A', 'B', 'C'][i % 3]
                    })),
                    operations: ['group_by_category', 'statistical_analysis', 'generate_report']
                };
        }
    }

    /**
     * Benchmark sequential execution
     */
    async benchmarkSequential(taskCount) {
        console.log(`\n=== Sequential Execution Benchmark (${taskCount} tasks) ===`);
        
        // Initialize for sequential
        process.env.PHASE = '2'; // Force Phase 2 (sequential)
        const instanceManager = new InstanceManager(this.stateDir);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const startTime = Date.now();
        const tasks = this.createTestTasks(taskCount);
        
        // Create hierarchy
        const executive = await instanceManager.spawnInstance(
            'executive',
            this.workDir,
            'Sequential execution benchmark'
        );
        
        const manager = await instanceManager.spawnInstance(
            'manager',
            this.workDir,
            'Sequential Manager',
            executive.instanceId
        );
        
        // Create single specialist
        const specialist = await instanceManager.spawnInstance(
            'specialist',
            this.workDir,
            'Sequential Specialist',
            manager.instanceId
        );
        
        const setupTime = Date.now() - startTime;
        
        // Execute tasks sequentially
        const executionStart = Date.now();
        const taskTimes = [];
        
        for (const task of tasks) {
            const taskStart = Date.now();
            
            // Send task to specialist
            await instanceManager.sendToInstance(specialist.instanceId, 
                `Execute task: ${JSON.stringify(task)}`);
            
            // Wait for completion (simulated)
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
            
            const taskDuration = Date.now() - taskStart;
            taskTimes.push(taskDuration);
            
            if ((tasks.indexOf(task) + 1) % 10 === 0) {
                console.log(`Completed ${tasks.indexOf(task) + 1}/${taskCount} tasks`);
            }
        }
        
        const executionTime = Date.now() - executionStart;
        const totalTime = Date.now() - startTime;
        
        // Calculate statistics
        const avgTaskTime = taskTimes.reduce((a, b) => a + b, 0) / taskTimes.length;
        const minTaskTime = Math.min(...taskTimes);
        const maxTaskTime = Math.max(...taskTimes);
        
        this.results.sequential = {
            taskCount,
            setupTime,
            executionTime,
            totalTime,
            avgTaskTime,
            minTaskTime,
            maxTaskTime,
            throughput: (taskCount / executionTime) * 1000 // tasks per second
        };
        
        console.log(`\nSequential Results:`);
        console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`  Setup time: ${(setupTime / 1000).toFixed(2)}s`);
        console.log(`  Execution time: ${(executionTime / 1000).toFixed(2)}s`);
        console.log(`  Throughput: ${this.results.sequential.throughput.toFixed(2)} tasks/s`);
        
        // Cleanup
        await instanceManager.cleanup();
    }

    /**
     * Benchmark parallel execution
     */
    async benchmarkParallel(taskCount, parallelism = 4) {
        console.log(`\n=== Parallel Execution Benchmark (${taskCount} tasks, ${parallelism} workers) ===`);
        
        // Initialize for parallel
        process.env.PHASE = '3'; // Force Phase 3 (parallel)
        const instanceManager = new InstanceManager(this.stateDir, { useRedis: true });
        const mcpTools = new EnhancedMCPTools(instanceManager);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const startTime = Date.now();
        const tasks = this.createTestTasks(taskCount);
        
        // Create hierarchy
        const executive = await instanceManager.spawnInstance(
            'executive',
            this.workDir,
            'Parallel execution benchmark'
        );
        
        const manager = await instanceManager.spawnInstance(
            'manager',
            this.workDir,
            'Parallel Manager',
            executive.instanceId
        );
        
        // Create multiple specialists
        const specialists = [];
        for (let i = 0; i < parallelism; i++) {
            const specialist = await instanceManager.spawnInstance(
                'specialist',
                this.workDir,
                `Parallel Specialist ${i + 1}`,
                manager.instanceId
            );
            specialists.push(specialist);
        }
        
        const setupTime = Date.now() - startTime;
        
        // Execute tasks in parallel
        const executionStart = Date.now();
        
        // Use enhanced MCP tools for parallel execution
        const results = await mcpTools.executeParallel({
            managerId: manager.instanceId,
            tasks,
            workDir: this.workDir
        }, 'manager');
        
        const executionTime = Date.now() - executionStart;
        const totalTime = Date.now() - startTime;
        
        this.results.parallel = {
            taskCount,
            parallelism,
            setupTime,
            executionTime,
            totalTime,
            completed: results.completed,
            failed: results.failed,
            throughput: (taskCount / executionTime) * 1000 // tasks per second
        };
        
        console.log(`\nParallel Results:`);
        console.log(`  Total time: ${(totalTime / 1000).toFixed(2)}s`);
        console.log(`  Setup time: ${(setupTime / 1000).toFixed(2)}s`);
        console.log(`  Execution time: ${(executionTime / 1000).toFixed(2)}s`);
        console.log(`  Throughput: ${this.results.parallel.throughput.toFixed(2)} tasks/s`);
        console.log(`  Completed: ${results.completed}/${taskCount}`);
        if (results.failed > 0) {
            console.log(`  Failed: ${results.failed}`);
        }
        
        // Cleanup
        await instanceManager.cleanup();
    }

    /**
     * Compare sequential vs parallel performance
     */
    compareResults() {
        console.log('\n=== Performance Comparison ===');
        
        if (!this.results.sequential.taskCount || !this.results.parallel.taskCount) {
            console.log('Missing benchmark data');
            return;
        }
        
        const speedup = this.results.sequential.executionTime / this.results.parallel.executionTime;
        const efficiency = speedup / this.results.parallel.parallelism;
        const throughputImprovement = this.results.parallel.throughput / this.results.sequential.throughput;
        
        this.results.comparison = {
            speedup,
            efficiency,
            throughputImprovement,
            setupOverhead: this.results.parallel.setupTime - this.results.sequential.setupTime
        };
        
        console.log(`\nSpeedup: ${speedup.toFixed(2)}x`);
        console.log(`Efficiency: ${(efficiency * 100).toFixed(1)}%`);
        console.log(`Throughput improvement: ${throughputImprovement.toFixed(2)}x`);
        console.log(`Setup overhead: ${(this.results.comparison.setupOverhead / 1000).toFixed(2)}s`);
        
        // Recommendations
        console.log('\nRecommendations:');
        if (efficiency < 0.7) {
            console.log('- Efficiency is below 70%, consider reducing parallelism');
            console.log('- Check for contention or synchronization bottlenecks');
        }
        if (this.results.comparison.setupOverhead > 5000) {
            console.log('- High setup overhead, parallel execution better for larger workloads');
        }
        if (speedup < this.results.parallel.parallelism * 0.5) {
            console.log('- Speedup is significantly below theoretical maximum');
            console.log('- Consider task granularity and communication overhead');
        }
    }

    /**
     * Run scaling test with different parallelism levels
     */
    async runScalingTest(taskCount) {
        console.log('\n=== Scaling Test ===');
        
        const parallelismLevels = [1, 2, 3];
        const scalingResults = [];
        
        for (const parallelism of parallelismLevels) {
            console.log(`\nTesting with ${parallelism} workers...`);
            
            await this.benchmarkParallel(taskCount, parallelism);
            
            scalingResults.push({
                parallelism,
                throughput: this.results.parallel.throughput,
                executionTime: this.results.parallel.executionTime,
                efficiency: this.results.parallel.throughput / (this.results.sequential?.throughput || 1) / parallelism
            });
            
            // Clean up between tests
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Generate scaling report
        console.log('\n=== Scaling Analysis ===');
        console.log('Parallelism | Throughput | Execution Time | Efficiency');
        console.log('------------|------------|----------------|------------');
        
        scalingResults.forEach(result => {
            console.log(
                `${result.parallelism.toString().padEnd(11)} | ` +
                `${result.throughput.toFixed(2).padEnd(10)} | ` +
                `${(result.executionTime / 1000).toFixed(2).padEnd(14)}s | ` +
                `${(result.efficiency * 100).toFixed(1)}%`
            );
        });
        
        // Find optimal parallelism
        const optimal = scalingResults.reduce((best, current) => 
            current.throughput > best.throughput ? current : best
        );
        
        console.log(`\nOptimal parallelism: ${optimal.parallelism} workers`);
        console.log(`Peak throughput: ${optimal.throughput.toFixed(2)} tasks/s`);
    }

    /**
     * Generate detailed report
     */
    generateReport() {
        const reportPath = path.join(this.stateDir, 'benchmark-report.json');
        fs.writeJsonSync(reportPath, this.results, { spaces: 2 });
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        // Generate CSV for graphing
        const csvPath = path.join(this.stateDir, 'benchmark-results.csv');
        const csv = [
            'Mode,TaskCount,Parallelism,SetupTime,ExecutionTime,TotalTime,Throughput',
            `Sequential,${this.results.sequential.taskCount},1,${this.results.sequential.setupTime},${this.results.sequential.executionTime},${this.results.sequential.totalTime},${this.results.sequential.throughput}`,
            `Parallel,${this.results.parallel.taskCount},${this.results.parallel.parallelism},${this.results.parallel.setupTime},${this.results.parallel.executionTime},${this.results.parallel.totalTime},${this.results.parallel.throughput}`
        ].join('\n');
        
        fs.writeFileSync(csvPath, csv);
        console.log(`CSV results saved to: ${csvPath}`);
    }

    async cleanup() {
        console.log('\n=== Cleanup ===');
        
        // Clean up any remaining sessions
        try {
            const { execSync } = await import('child_process');
            execSync('tmux kill-server', { stdio: 'ignore' });
        } catch (e) {
            // Ignore
        }
        
        console.log('Cleanup complete');
    }

    async run() {
        try {
            await this.setup();
            
            // Run benchmarks
            const taskCount = 10; // Reduced for faster tests
            
            // Sequential benchmark
            await this.benchmarkSequential(taskCount);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Parallel benchmark
            await this.benchmarkParallel(taskCount, 2);
            
            // Compare results
            this.compareResults();
            
            // Run scaling test (disabled for quick tests)
            // await this.runScalingTest(10);
            
            // Generate report
            this.generateReport();
            
        } catch (error) {
            console.error('Benchmark failed:', error);
        } finally {
            await this.cleanup();
        }
    }
}

// Run benchmark
const benchmark = new PerformanceBenchmark();
benchmark.run().catch(console.error);