/**
 * Job Result Aggregator and Reporter
 * 
 * Collects results from distributed tasks and provides
 * aggregated reporting and analysis capabilities
 */

import { RedisStateStore } from './redis_state_store.js';
import fs from 'fs-extra';
import path from 'path';

export class JobResultAggregator {
    constructor(options = {}) {
        this.stateStore = null;
        this.reportDir = options.reportDir || './reports';
        this.aggregationInterval = options.aggregationInterval || 60000; // 1 minute
        this.retentionPeriod = options.retentionPeriod || 86400000; // 24 hours
        
        this.aggregationTimer = null;
        this.isAggregating = false;
        
        // In-memory cache for active jobs
        this.activeJobs = new Map();
        this.completedJobs = new Map();
        
        // Aggregated metrics
        this.metrics = {
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            averageExecutionTime: 0,
            successRate: 0,
            throughput: 0
        };
    }

    async initialize() {
        // Initialize state store
        if (process.env.PHASE === '3') {
            this.stateStore = new RedisStateStore();
            await this.stateStore.initialize();
        }
        
        // Ensure report directory exists
        await fs.ensureDir(this.reportDir);
        
        console.log('JobResultAggregator initialized');
    }

    /**
     * Start automatic aggregation
     */
    startAggregation() {
        if (this.isAggregating) return;
        
        this.isAggregating = true;
        console.log('Starting job result aggregation');
        
        // Initial aggregation
        this.performAggregation();
        
        // Set up periodic aggregation
        this.aggregationTimer = setInterval(() => {
            this.performAggregation();
        }, this.aggregationInterval);
    }

    /**
     * Stop automatic aggregation
     */
    stopAggregation() {
        if (!this.isAggregating) return;
        
        if (this.aggregationTimer) {
            clearInterval(this.aggregationTimer);
            this.aggregationTimer = null;
        }
        
        this.isAggregating = false;
        console.log('Stopped job result aggregation');
    }

    /**
     * Record job start
     */
    recordJobStart(jobId, jobData) {
        this.activeJobs.set(jobId, {
            id: jobId,
            ...jobData,
            startTime: Date.now(),
            status: 'running'
        });
        
        this.metrics.totalJobs++;
    }

    /**
     * Record job completion
     */
    async recordJobCompletion(jobId, result) {
        const job = this.activeJobs.get(jobId);
        if (!job) {
            console.warn(`No active job found for ID: ${jobId}`);
            return;
        }
        
        const completedJob = {
            ...job,
            endTime: Date.now(),
            duration: Date.now() - job.startTime,
            status: result.success ? 'completed' : 'failed',
            result
        };
        
        // Move to completed
        this.activeJobs.delete(jobId);
        this.completedJobs.set(jobId, completedJob);
        
        // Update metrics
        if (result.success) {
            this.metrics.completedJobs++;
        } else {
            this.metrics.failedJobs++;
        }
        
        // Store in state store if available
        if (this.stateStore) {
            await this.stateStore.recordMetric('job_completion', {
                jobId,
                duration: completedJob.duration,
                success: result.success,
                timestamp: new Date().toISOString()
            });
        }
        
        // Clean up old completed jobs
        this.cleanupOldJobs();
    }

    /**
     * Clean up old completed jobs
     */
    cleanupOldJobs() {
        const cutoffTime = Date.now() - this.retentionPeriod;
        
        for (const [jobId, job] of this.completedJobs) {
            if (job.endTime < cutoffTime) {
                this.completedJobs.delete(jobId);
            }
        }
    }

    /**
     * Perform aggregation
     */
    async performAggregation() {
        try {
            const now = Date.now();
            const aggregationWindow = this.aggregationInterval;
            
            // Get recent completed jobs
            const recentJobs = Array.from(this.completedJobs.values())
                .filter(job => now - job.endTime < aggregationWindow);
            
            if (recentJobs.length === 0) {
                return;
            }
            
            // Calculate aggregated metrics
            const aggregatedData = this.calculateAggregates(recentJobs);
            
            // Generate reports
            await this.generateReports(aggregatedData);
            
            // Store aggregated metrics
            if (this.stateStore) {
                await this.stateStore.recordMetric('job_aggregation', aggregatedData);
            }
            
        } catch (error) {
            console.error('Aggregation error:', error);
        }
    }

    /**
     * Calculate aggregate metrics
     */
    calculateAggregates(jobs) {
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter(j => j.status === 'completed').length;
        const failedJobs = jobs.filter(j => j.status === 'failed').length;
        
        // Calculate average execution time
        const executionTimes = jobs.map(j => j.duration);
        const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / totalJobs;
        
        // Calculate success rate
        const successRate = completedJobs / totalJobs;
        
        // Group by type
        const jobsByType = {};
        jobs.forEach(job => {
            const type = job.type || 'unknown';
            if (!jobsByType[type]) {
                jobsByType[type] = {
                    count: 0,
                    completed: 0,
                    failed: 0,
                    totalDuration: 0
                };
            }
            jobsByType[type].count++;
            jobsByType[type].totalDuration += job.duration;
            if (job.status === 'completed') {
                jobsByType[type].completed++;
            } else {
                jobsByType[type].failed++;
            }
        });
        
        // Group by manager
        const jobsByManager = {};
        jobs.forEach(job => {
            const managerId = job.managerId || 'unknown';
            if (!jobsByManager[managerId]) {
                jobsByManager[managerId] = {
                    count: 0,
                    completed: 0,
                    failed: 0,
                    totalDuration: 0
                };
            }
            jobsByManager[managerId].count++;
            jobsByManager[managerId].totalDuration += job.duration;
            if (job.status === 'completed') {
                jobsByManager[managerId].completed++;
            } else {
                jobsByManager[managerId].failed++;
            }
        });
        
        // Calculate percentiles
        const sortedTimes = executionTimes.sort((a, b) => a - b);
        const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
        const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)];
        const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
        
        return {
            timestamp: new Date().toISOString(),
            window: this.aggregationInterval,
            summary: {
                totalJobs,
                completedJobs,
                failedJobs,
                successRate: (successRate * 100).toFixed(2) + '%',
                avgExecutionTime: Math.round(avgExecutionTime),
                throughput: (totalJobs / (this.aggregationInterval / 1000)).toFixed(2)
            },
            percentiles: {
                p50,
                p90,
                p99
            },
            byType: jobsByType,
            byManager: jobsByManager
        };
    }

    /**
     * Generate reports
     */
    async generateReports(aggregatedData) {
        // Generate summary report
        const summaryPath = path.join(this.reportDir, 'job_summary.json');
        await fs.writeJson(summaryPath, aggregatedData, { spaces: 2 });
        
        // Generate time-series report
        const timeSeriesPath = path.join(this.reportDir, 'job_timeseries.jsonl');
        await fs.appendFile(
            timeSeriesPath,
            JSON.stringify({
                timestamp: aggregatedData.timestamp,
                ...aggregatedData.summary
            }) + '\n'
        );
        
        // Generate detailed report if many jobs
        if (aggregatedData.summary.totalJobs > 100) {
            await this.generateDetailedReport(aggregatedData);
        }
    }

    /**
     * Generate detailed analytical report
     */
    async generateDetailedReport(aggregatedData) {
        const reportTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const detailedPath = path.join(this.reportDir, `detailed_report_${reportTimestamp}.md`);
        
        let report = `# Job Execution Report\n\n`;
        report += `Generated: ${new Date().toLocaleString()}\n\n`;
        
        // Executive Summary
        report += `## Executive Summary\n\n`;
        report += `- **Total Jobs**: ${aggregatedData.summary.totalJobs}\n`;
        report += `- **Success Rate**: ${aggregatedData.summary.successRate}\n`;
        report += `- **Average Execution Time**: ${aggregatedData.summary.avgExecutionTime}ms\n`;
        report += `- **Throughput**: ${aggregatedData.summary.throughput} jobs/second\n\n`;
        
        // Performance Distribution
        report += `## Performance Distribution\n\n`;
        report += `| Percentile | Execution Time |\n`;
        report += `|------------|----------------|\n`;
        report += `| 50th (P50) | ${aggregatedData.percentiles.p50}ms |\n`;
        report += `| 90th (P90) | ${aggregatedData.percentiles.p90}ms |\n`;
        report += `| 99th (P99) | ${aggregatedData.percentiles.p99}ms |\n\n`;
        
        // Analysis by Job Type
        report += `## Analysis by Job Type\n\n`;
        report += `| Type | Count | Success Rate | Avg Duration |\n`;
        report += `|------|-------|--------------|---------------|\n`;
        
        Object.entries(aggregatedData.byType).forEach(([type, stats]) => {
            const successRate = ((stats.completed / stats.count) * 100).toFixed(1);
            const avgDuration = Math.round(stats.totalDuration / stats.count);
            report += `| ${type} | ${stats.count} | ${successRate}% | ${avgDuration}ms |\n`;
        });
        
        report += `\n`;
        
        // Analysis by Manager
        report += `## Analysis by Manager\n\n`;
        report += `| Manager ID | Jobs | Success Rate | Avg Duration |\n`;
        report += `|------------|------|--------------|---------------|\n`;
        
        Object.entries(aggregatedData.byManager).forEach(([managerId, stats]) => {
            const successRate = ((stats.completed / stats.count) * 100).toFixed(1);
            const avgDuration = Math.round(stats.totalDuration / stats.count);
            report += `| ${managerId} | ${stats.count} | ${successRate}% | ${avgDuration}ms |\n`;
        });
        
        report += `\n`;
        
        // Recommendations
        report += `## Recommendations\n\n`;
        
        if (parseFloat(aggregatedData.summary.successRate) < 95) {
            report += `- ⚠️ Success rate is below 95%. Investigate failing jobs.\n`;
        }
        
        if (aggregatedData.percentiles.p99 > aggregatedData.percentiles.p50 * 10) {
            report += `- ⚠️ High variance in execution times (P99 >> P50). Check for outliers.\n`;
        }
        
        // Find underperforming managers
        const underperformingManagers = Object.entries(aggregatedData.byManager)
            .filter(([_, stats]) => (stats.completed / stats.count) < 0.9)
            .map(([managerId]) => managerId);
        
        if (underperformingManagers.length > 0) {
            report += `- ⚠️ Managers with low success rates: ${underperformingManagers.join(', ')}\n`;
        }
        
        await fs.writeFile(detailedPath, report);
        console.log(`Detailed report generated: ${detailedPath}`);
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        // Update live metrics
        const activeCount = this.activeJobs.size;
        const completedCount = this.completedJobs.size;
        
        // Calculate current success rate
        const recentJobs = Array.from(this.completedJobs.values());
        const recentCompleted = recentJobs.filter(j => j.status === 'completed').length;
        const currentSuccessRate = recentJobs.length > 0 ? 
            (recentCompleted / recentJobs.length) : 0;
        
        return {
            ...this.metrics,
            activeJobs: activeCount,
            completedInMemory: completedCount,
            currentSuccessRate: (currentSuccessRate * 100).toFixed(2) + '%'
        };
    }

    /**
     * Get job details
     */
    getJobDetails(jobId) {
        return this.activeJobs.get(jobId) || this.completedJobs.get(jobId) || null;
    }

    /**
     * Export results to CSV
     */
    async exportToCSV(outputPath) {
        const jobs = Array.from(this.completedJobs.values());
        
        if (jobs.length === 0) {
            console.log('No completed jobs to export');
            return;
        }
        
        const headers = ['JobID', 'Type', 'Status', 'StartTime', 'EndTime', 'Duration', 'ManagerID'];
        const rows = [headers];
        
        jobs.forEach(job => {
            rows.push([
                job.id,
                job.type || 'unknown',
                job.status,
                new Date(job.startTime).toISOString(),
                new Date(job.endTime).toISOString(),
                job.duration,
                job.managerId || 'unknown'
            ]);
        });
        
        const csv = rows.map(row => row.join(',')).join('\n');
        await fs.writeFile(outputPath, csv);
        console.log(`Exported ${jobs.length} jobs to ${outputPath}`);
    }
}