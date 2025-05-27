/**
 * Distributed Tracer for tmux-claude
 * 
 * Provides distributed tracing capabilities for debugging
 * parallel execution across multiple Claude instances
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';

export class DistributedTracer {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.logDir = options.logDir || './logs/traces';
        this.maxTraceAge = options.maxTraceAge || 86400000; // 24 hours
        this.sampling = options.sampling || 1.0; // 100% sampling by default
        
        // In-memory trace storage for quick access
        this.activeTraces = new Map();
        this.completedTraces = new Map();
        
        // Ensure trace directory exists
        if (this.enabled) {
            fs.ensureDirSync(this.logDir);
        }
    }

    /**
     * Start a new trace
     */
    startTrace(operationName, metadata = {}) {
        if (!this.shouldSample()) return null;
        
        const traceId = uuidv4();
        const trace = {
            traceId,
            operationName,
            startTime: Date.now(),
            spans: [],
            metadata,
            status: 'active'
        };
        
        this.activeTraces.set(traceId, trace);
        
        return {
            traceId,
            startSpan: (spanName, parentSpanId = null) => 
                this.startSpan(traceId, spanName, parentSpanId),
            endTrace: (status = 'success', error = null) => 
                this.endTrace(traceId, status, error)
        };
    }

    /**
     * Start a new span within a trace
     */
    startSpan(traceId, spanName, parentSpanId = null) {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return null;
        
        const spanId = uuidv4();
        const span = {
            spanId,
            spanName,
            parentSpanId,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            tags: {},
            logs: [],
            status: 'active'
        };
        
        trace.spans.push(span);
        
        return {
            spanId,
            setTag: (key, value) => this.setSpanTag(traceId, spanId, key, value),
            log: (message, level = 'info') => this.addSpanLog(traceId, spanId, message, level),
            endSpan: (status = 'success', error = null) => 
                this.endSpan(traceId, spanId, status, error)
        };
    }

    /**
     * Set a tag on a span
     */
    setSpanTag(traceId, spanId, key, value) {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;
        
        const span = trace.spans.find(s => s.spanId === spanId);
        if (span) {
            span.tags[key] = value;
        }
    }

    /**
     * Add a log entry to a span
     */
    addSpanLog(traceId, spanId, message, level = 'info') {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;
        
        const span = trace.spans.find(s => s.spanId === spanId);
        if (span) {
            span.logs.push({
                timestamp: Date.now(),
                level,
                message
            });
        }
    }

    /**
     * End a span
     */
    endSpan(traceId, spanId, status = 'success', error = null) {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;
        
        const span = trace.spans.find(s => s.spanId === spanId);
        if (span) {
            span.endTime = Date.now();
            span.duration = span.endTime - span.startTime;
            span.status = status;
            if (error) {
                span.error = {
                    message: error.message,
                    stack: error.stack
                };
            }
        }
    }

    /**
     * End a trace
     */
    endTrace(traceId, status = 'success', error = null) {
        const trace = this.activeTraces.get(traceId);
        if (!trace) return;
        
        trace.endTime = Date.now();
        trace.duration = trace.endTime - trace.startTime;
        trace.status = status;
        if (error) {
            trace.error = {
                message: error.message,
                stack: error.stack
            };
        }
        
        // Move to completed
        this.activeTraces.delete(traceId);
        this.completedTraces.set(traceId, trace);
        
        // Save to disk
        if (this.enabled) {
            this.saveTrace(trace);
        }
        
        // Clean up old traces
        this.cleanupOldTraces();
    }

    /**
     * Save trace to disk
     */
    async saveTrace(trace) {
        const timestamp = new Date(trace.startTime).toISOString().replace(/[:.]/g, '-');
        const filename = `trace_${trace.operationName}_${timestamp}_${trace.traceId}.json`;
        const filepath = path.join(this.logDir, filename);
        
        try {
            await fs.writeJson(filepath, trace, { spaces: 2 });
        } catch (error) {
            console.error(`Failed to save trace ${trace.traceId}:`, error);
        }
    }

    /**
     * Clean up old traces
     */
    cleanupOldTraces() {
        const cutoff = Date.now() - this.maxTraceAge;
        
        // Clean completed traces in memory
        for (const [traceId, trace] of this.completedTraces) {
            if (trace.endTime < cutoff) {
                this.completedTraces.delete(traceId);
            }
        }
        
        // Clean trace files
        if (this.enabled) {
            fs.readdir(this.logDir, (err, files) => {
                if (err) return;
                
                files.forEach(file => {
                    const filepath = path.join(this.logDir, file);
                    fs.stat(filepath, (err, stats) => {
                        if (!err && stats.mtime.getTime() < cutoff) {
                            fs.unlink(filepath, () => {});
                        }
                    });
                });
            });
        }
    }

    /**
     * Check if we should sample this trace
     */
    shouldSample() {
        return this.enabled && Math.random() < this.sampling;
    }

    /**
     * Get a trace by ID
     */
    getTrace(traceId) {
        return this.activeTraces.get(traceId) || this.completedTraces.get(traceId);
    }

    /**
     * Get all active traces
     */
    getActiveTraces() {
        return Array.from(this.activeTraces.values());
    }

    /**
     * Get recent completed traces
     */
    getRecentTraces(limit = 10) {
        const traces = Array.from(this.completedTraces.values());
        return traces
            .sort((a, b) => b.endTime - a.endTime)
            .slice(0, limit);
    }

    /**
     * Generate trace report
     */
    generateReport(traceId) {
        const trace = this.getTrace(traceId);
        if (!trace) return null;
        
        const report = {
            summary: {
                traceId: trace.traceId,
                operation: trace.operationName,
                status: trace.status,
                duration: trace.duration,
                spanCount: trace.spans.length
            },
            timeline: this.generateTimeline(trace),
            criticalPath: this.findCriticalPath(trace),
            errors: this.collectErrors(trace),
            statistics: this.calculateStatistics(trace)
        };
        
        return report;
    }

    /**
     * Generate timeline visualization
     */
    generateTimeline(trace) {
        const timeline = [];
        const startTime = trace.startTime;
        
        // Add trace start
        timeline.push({
            time: 0,
            event: 'trace_start',
            name: trace.operationName
        });
        
        // Add span events
        trace.spans.forEach(span => {
            timeline.push({
                time: span.startTime - startTime,
                event: 'span_start',
                name: span.spanName,
                spanId: span.spanId
            });
            
            if (span.endTime) {
                timeline.push({
                    time: span.endTime - startTime,
                    event: 'span_end',
                    name: span.spanName,
                    spanId: span.spanId,
                    duration: span.duration
                });
            }
        });
        
        // Add trace end
        if (trace.endTime) {
            timeline.push({
                time: trace.endTime - startTime,
                event: 'trace_end',
                name: trace.operationName
            });
        }
        
        return timeline.sort((a, b) => a.time - b.time);
    }

    /**
     * Find critical path through trace
     */
    findCriticalPath(trace) {
        // Build span tree
        const spanMap = new Map();
        trace.spans.forEach(span => spanMap.set(span.spanId, span));
        
        // Find root spans
        const rootSpans = trace.spans.filter(s => !s.parentSpanId);
        
        // Find longest path from each root
        let criticalPath = [];
        let maxDuration = 0;
        
        rootSpans.forEach(root => {
            const path = this.findLongestPath(root, spanMap);
            const duration = path.reduce((sum, span) => sum + (span.duration || 0), 0);
            
            if (duration > maxDuration) {
                maxDuration = duration;
                criticalPath = path;
            }
        });
        
        return {
            path: criticalPath.map(s => ({
                spanId: s.spanId,
                name: s.spanName,
                duration: s.duration
            })),
            totalDuration: maxDuration
        };
    }

    /**
     * Find longest path from a span
     */
    findLongestPath(span, spanMap) {
        const children = Array.from(spanMap.values())
            .filter(s => s.parentSpanId === span.spanId);
        
        if (children.length === 0) {
            return [span];
        }
        
        let longestChildPath = [];
        let maxChildDuration = 0;
        
        children.forEach(child => {
            const childPath = this.findLongestPath(child, spanMap);
            const childDuration = childPath.reduce((sum, s) => sum + (s.duration || 0), 0);
            
            if (childDuration > maxChildDuration) {
                maxChildDuration = childDuration;
                longestChildPath = childPath;
            }
        });
        
        return [span, ...longestChildPath];
    }

    /**
     * Collect all errors in trace
     */
    collectErrors(trace) {
        const errors = [];
        
        if (trace.error) {
            errors.push({
                type: 'trace',
                name: trace.operationName,
                error: trace.error
            });
        }
        
        trace.spans.forEach(span => {
            if (span.error) {
                errors.push({
                    type: 'span',
                    name: span.spanName,
                    spanId: span.spanId,
                    error: span.error
                });
            }
            
            // Check logs for errors
            span.logs.forEach(log => {
                if (log.level === 'error') {
                    errors.push({
                        type: 'log',
                        spanName: span.spanName,
                        spanId: span.spanId,
                        timestamp: log.timestamp,
                        message: log.message
                    });
                }
            });
        });
        
        return errors;
    }

    /**
     * Calculate trace statistics
     */
    calculateStatistics(trace) {
        const spanDurations = trace.spans
            .filter(s => s.duration !== null)
            .map(s => s.duration);
        
        if (spanDurations.length === 0) {
            return null;
        }
        
        spanDurations.sort((a, b) => a - b);
        
        return {
            spanCount: trace.spans.length,
            completedSpans: spanDurations.length,
            totalDuration: trace.duration,
            spanDurations: {
                min: spanDurations[0],
                max: spanDurations[spanDurations.length - 1],
                avg: spanDurations.reduce((a, b) => a + b, 0) / spanDurations.length,
                median: spanDurations[Math.floor(spanDurations.length / 2)],
                p95: spanDurations[Math.floor(spanDurations.length * 0.95)],
                p99: spanDurations[Math.floor(spanDurations.length * 0.99)]
            }
        };
    }

    /**
     * Export trace for external analysis
     */
    exportTrace(traceId, format = 'json') {
        const trace = this.getTrace(traceId);
        if (!trace) return null;
        
        switch (format) {
            case 'json':
                return JSON.stringify(trace, null, 2);
                
            case 'jaeger':
                return this.convertToJaegerFormat(trace);
                
            case 'zipkin':
                return this.convertToZipkinFormat(trace);
                
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Convert to Jaeger format
     */
    convertToJaegerFormat(trace) {
        // Simplified Jaeger format conversion
        return {
            traceID: trace.traceId,
            spans: trace.spans.map(span => ({
                traceID: trace.traceId,
                spanID: span.spanId,
                operationName: span.spanName,
                references: span.parentSpanId ? [{
                    refType: 'CHILD_OF',
                    traceID: trace.traceId,
                    spanID: span.parentSpanId
                }] : [],
                startTime: span.startTime * 1000, // microseconds
                duration: (span.duration || 0) * 1000,
                tags: Object.entries(span.tags).map(([key, value]) => ({
                    key,
                    type: typeof value === 'string' ? 'string' : 'number',
                    value: value.toString()
                })),
                logs: span.logs.map(log => ({
                    timestamp: log.timestamp * 1000,
                    fields: [{
                        key: 'level',
                        value: log.level
                    }, {
                        key: 'message',
                        value: log.message
                    }]
                })),
                process: {
                    serviceName: 'tmux-claude',
                    tags: []
                }
            }))
        };
    }

    /**
     * Convert to Zipkin format
     */
    convertToZipkinFormat(trace) {
        // Simplified Zipkin format conversion
        return trace.spans.map(span => ({
            traceId: trace.traceId,
            id: span.spanId,
            parentId: span.parentSpanId,
            name: span.spanName,
            timestamp: span.startTime * 1000,
            duration: (span.duration || 0) * 1000,
            localEndpoint: {
                serviceName: 'tmux-claude'
            },
            tags: span.tags,
            annotations: span.logs.map(log => ({
                timestamp: log.timestamp * 1000,
                value: `${log.level}: ${log.message}`
            }))
        }));
    }
}

// Singleton instance for easy access
export const tracer = new DistributedTracer({
    enabled: process.env.ENABLE_TRACING === 'true',
    sampling: parseFloat(process.env.TRACE_SAMPLING || '0.1') // 10% by default
});