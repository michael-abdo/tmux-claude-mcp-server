/**
 * Job Queue System for Phase 3
 * 
 * Provides priority-based job queuing and distribution for the
 * Executive to manage multiple concurrent jobs across Managers.
 */

export class JobQueue {
    constructor(stateStore = null) {
        this.stateStore = stateStore;
        this.jobs = new Map();
        this.pendingJobs = [];
        this.activeJobs = new Map();
        this.completedJobs = [];
        this.jobIdCounter = 1;
    }

    /**
     * Add a new job to the queue
     */
    async enqueueJob(jobSpec, priority = 'medium') {
        const job = {
            id: `job_${Date.now()}_${this.jobIdCounter++}`,
            spec: jobSpec,
            priority: this.getPriorityValue(priority),
            status: 'pending',
            enqueuedAt: new Date().toISOString(),
            attempts: 0,
            maxAttempts: 3
        };
        
        this.jobs.set(job.id, job);
        this.pendingJobs.push(job);
        
        // Sort by priority (higher value = higher priority)
        this.pendingJobs.sort((a, b) => b.priority - a.priority);
        
        // Persist to state store if available
        if (this.stateStore) {
            await this.stateStore.saveInstance(`job:${job.id}`, job);
        }
        
        console.log(`Job ${job.id} enqueued with priority ${priority}`);
        return job;
    }

    /**
     * Get the next job from the queue
     */
    async dequeueJob() {
        if (this.pendingJobs.length === 0) {
            return null;
        }
        
        const job = this.pendingJobs.shift();
        job.status = 'assigned';
        job.assignedAt = new Date().toISOString();
        
        // Update state store
        if (this.stateStore) {
            await this.stateStore.saveInstance(`job:${job.id}`, job);
        }
        
        return job;
    }

    /**
     * Mark a job as active (being processed)
     */
    async markJobActive(jobId, managerId) {
        const job = this.jobs.get(jobId);
        if (!job) return false;
        
        job.status = 'active';
        job.managerId = managerId;
        job.startedAt = new Date().toISOString();
        job.attempts++;
        
        this.activeJobs.set(jobId, job);
        
        // Update state store
        if (this.stateStore) {
            await this.stateStore.saveInstance(`job:${jobId}`, job);
        }
        
        console.log(`Job ${jobId} marked active, assigned to Manager ${managerId}`);
        return true;
    }

    /**
     * Mark a job as completed
     */
    async markJobCompleted(jobId, results) {
        const job = this.jobs.get(jobId);
        if (!job) return false;
        
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        job.results = results;
        job.duration = new Date(job.completedAt) - new Date(job.startedAt);
        
        this.activeJobs.delete(jobId);
        this.completedJobs.push(job);
        
        // Update state store
        if (this.stateStore) {
            await this.stateStore.saveInstance(`job:${jobId}`, job);
            await this.stateStore.recordMetric('job_completed', {
                jobId,
                duration: job.duration,
                tasksCompleted: results.completed || 0,
                tasksFailed: results.failed || 0
            });
        }
        
        console.log(`Job ${jobId} completed in ${Math.round(job.duration / 1000)}s`);
        return true;
    }

    /**
     * Mark a job as failed
     */
    async markJobFailed(jobId, error) {
        const job = this.jobs.get(jobId);
        if (!job) return false;
        
        job.lastError = error;
        this.activeJobs.delete(jobId);
        
        if (job.attempts < job.maxAttempts) {
            // Re-queue for retry
            job.status = 'pending';
            job.nextRetryAt = new Date(Date.now() + this.getRetryDelay(job.attempts)).toISOString();
            this.pendingJobs.push(job);
            this.pendingJobs.sort((a, b) => b.priority - a.priority);
            
            console.log(`Job ${jobId} failed (attempt ${job.attempts}/${job.maxAttempts}), re-queued for retry`);
        } else {
            // Max attempts reached
            job.status = 'failed';
            job.failedAt = new Date().toISOString();
            
            console.log(`Job ${jobId} permanently failed after ${job.maxAttempts} attempts`);
        }
        
        // Update state store
        if (this.stateStore) {
            await this.stateStore.saveInstance(`job:${jobId}`, job);
        }
        
        return true;
    }

    /**
     * Get jobs ready for assignment (considering retry delays)
     */
    getReadyJobs(limit = 10) {
        const now = new Date();
        const readyJobs = this.pendingJobs.filter(job => {
            if (job.nextRetryAt) {
                return new Date(job.nextRetryAt) <= now;
            }
            return true;
        });
        
        return readyJobs.slice(0, limit);
    }

    /**
     * Get queue statistics
     */
    getStatistics() {
        const stats = {
            total: this.jobs.size,
            pending: this.pendingJobs.length,
            active: this.activeJobs.size,
            completed: this.completedJobs.length,
            failed: Array.from(this.jobs.values()).filter(j => j.status === 'failed').length,
            byPriority: {
                critical: 0,
                high: 0,
                medium: 0,
                low: 0
            }
        };
        
        // Count by priority
        this.pendingJobs.forEach(job => {
            const priorityName = this.getPriorityName(job.priority);
            stats.byPriority[priorityName]++;
        });
        
        return stats;
    }

    /**
     * Clean up old completed jobs
     */
    async cleanupOldJobs(retentionHours = 24) {
        const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000);
        
        this.completedJobs = this.completedJobs.filter(job => {
            const completedAt = new Date(job.completedAt);
            if (completedAt < cutoffTime) {
                this.jobs.delete(job.id);
                if (this.stateStore) {
                    this.stateStore.deleteInstance(`job:${job.id}`).catch(() => {});
                }
                return false;
            }
            return true;
        });
    }

    /**
     * Get priority value from name
     */
    getPriorityValue(priority) {
        const priorities = {
            critical: 100,
            high: 75,
            medium: 50,
            low: 25
        };
        return priorities[priority] || 50;
    }

    /**
     * Get priority name from value
     */
    getPriorityName(value) {
        if (value >= 100) return 'critical';
        if (value >= 75) return 'high';
        if (value >= 50) return 'medium';
        return 'low';
    }

    /**
     * Calculate retry delay with exponential backoff
     */
    getRetryDelay(attempt) {
        return Math.min(1000 * Math.pow(2, attempt), 60000); // Max 1 minute
    }

    /**
     * Load jobs from state store on startup
     */
    async loadFromStateStore() {
        if (!this.stateStore) return;
        
        try {
            const allInstances = await this.stateStore.getAllInstances();
            
            for (const [key, data] of Object.entries(allInstances)) {
                if (key.startsWith('job:')) {
                    const job = data;
                    this.jobs.set(job.id, job);
                    
                    if (job.status === 'pending') {
                        this.pendingJobs.push(job);
                    } else if (job.status === 'active') {
                        // Reset active jobs to pending on startup
                        job.status = 'pending';
                        this.pendingJobs.push(job);
                    } else if (job.status === 'completed') {
                        this.completedJobs.push(job);
                    }
                }
            }
            
            // Sort pending jobs by priority
            this.pendingJobs.sort((a, b) => b.priority - a.priority);
            
            console.log(`Loaded ${this.jobs.size} jobs from state store`);
        } catch (error) {
            console.error('Failed to load jobs from state store:', error);
        }
    }
}