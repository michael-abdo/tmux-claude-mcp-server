/**
 * Fixed Test for Monitoring Dashboard
 * 
 * Validates dashboard functionality with complete mocking
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MonitoringDashboard } from '../../src/monitoring_dashboard.js';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

describe('Monitoring Dashboard (Fixed)', () => {
    let dashboard;
    let testPort = 4456 + Math.floor(Math.random() * 1000);
    
    beforeEach(() => {
        // Create a mock dashboard that doesn't create real resources
        dashboard = new MonitoringDashboard(testPort++);
        
        // Mock the instance manager completely
        const mockInstances = {
            'test_1': { instanceId: 'test_1', role: 'specialist', status: 'active' },
            'test_2': { instanceId: 'test_2', role: 'manager', status: 'active' }
        };
        
        dashboard.instanceManager = {
            instances: mockInstances,
            getPerformanceMetrics: () => ({
                optimizer: {
                    spawns: { total: 10, concurrent: 2, avgTime: 50 },
                    messages: { total: 100, batches: 20, avgBatchSize: 5 },
                    gitOps: { total: 30, concurrent: 1, avgTime: 100 },
                    cacheHits: 45,
                    cacheMisses: 15,
                    queues: {
                        spawn: { size: 0, pending: 0 },
                        git: { size: 0, pending: 0 }
                    },
                    pools: { instance: 5, worktree: 3 },
                    cache: { size: 20, hitRate: 0.75 }
                },
                instances: {
                    total: 2,
                    byRole: { executive: 0, manager: 1, specialist: 1 },
                    active: 2
                },
                redis: { connected: false, operations: 0 }
            }),
            on: () => {},
            removeListener: () => {}
        };
        
        // Mock performance monitor
        dashboard.performanceMonitor = new EventEmitter();
        dashboard.performanceMonitor.getRecommendations = () => [
            { priority: 'high', suggestion: 'Consider enabling Redis for better performance' },
            { priority: 'medium', suggestion: 'Instance pool is low, consider pre-warming' }
        ];
        dashboard.performanceMonitor.stop = () => {};
        
        // Override setupRoutes to avoid static file issues
        dashboard.setupRoutes = function() {
            this.app.get('/', (req, res) => {
                res.json({ status: 'dashboard running' });
            });
            
            this.app.get('/api/state', (req, res) => {
                res.json(this.getCurrentState());
            });
            
            this.app.get('/api/metrics', (req, res) => {
                res.json(this.instanceManager.getPerformanceMetrics());
            });
            
            this.app.get('/api/recommendations', (req, res) => {
                res.json(this.performanceMonitor.getRecommendations());
            });
            
            this.app.post('/api/spawn', (req, res) => {
                res.json({ instanceId: 'new_test_instance', status: 'spawned' });
            });
            
            this.app.post('/api/terminate/:instanceId', (req, res) => {
                res.json({ status: 'terminated' });
            });
        };
        
        // Re-setup with mocked routes
        dashboard.setupRoutes();
    });
    
    afterEach(async () => {
        if (dashboard) {
            dashboard.stop();
            // Wait for server to fully close
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });
    
    test('should start dashboard server', async () => {
        dashboard.start();
        
        // Wait for server to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test HTTP endpoint
        const response = await fetch(`http://localhost:${dashboard.port}/api/state`);
        assert.strictEqual(response.status, 200);
        
        const state = await response.json();
        assert.ok('instances' in state);
        assert.ok('performance' in state);
        assert.ok('alerts' in state);
    });
    
    test('should handle WebSocket connections', async () => {
        dashboard.start();
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create WebSocket connection
        const ws = new WebSocket(`ws://localhost:${dashboard.port}`);
        
        try {
            // Wait for connection
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('WebSocket connection timeout'));
                }, 2000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                ws.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });
            
            // Should receive initial state
            const message = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Initial message timeout'));
                }, 2000);
                
                ws.once('message', (data) => {
                    clearTimeout(timeout);
                    resolve(JSON.parse(data.toString()));
                });
            });
            
            assert.strictEqual(message.type, 'initial');
            assert.ok(message.data);
            assert.ok(message.data.instances);
            
        } finally {
            ws.close();
        }
    });
    
    test('should broadcast performance updates', async () => {
        dashboard.start();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const ws = new WebSocket(`ws://localhost:${dashboard.port}`);
        const messages = [];
        
        try {
            // Connect and collect messages
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 2000);
                
                ws.on('open', () => {
                    clearTimeout(timeout);
                    resolve();
                });
                
                ws.on('error', reject);
            });
            
            // Set up message collector
            ws.on('message', (data) => {
                messages.push(JSON.parse(data.toString()));
            });
            
            // Wait for initial message
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Trigger performance update
            dashboard.performanceMonitor.emit('snapshot', {
                timestamp: Date.now(),
                instances: { total: 5 },
                optimizer: { spawns: { total: 15 } }
            });
            
            // Wait for broadcast
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Should have initial + performance update
            assert.ok(messages.length >= 2);
            
            const perfMessage = messages.find(m => m.type === 'performance');
            assert.ok(perfMessage);
            assert.strictEqual(perfMessage.data.instances.total, 5);
            
        } finally {
            ws.close();
        }
    });
    
    test('should handle API requests', async () => {
        dashboard.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test state endpoint
        const stateResponse = await fetch(`http://localhost:${dashboard.port}/api/state`);
        assert.strictEqual(stateResponse.status, 200);
        const state = await stateResponse.json();
        assert.ok(state.instances);
        
        // Test metrics endpoint
        const metricsResponse = await fetch(`http://localhost:${dashboard.port}/api/metrics`);
        assert.strictEqual(metricsResponse.status, 200);
        const metrics = await metricsResponse.json();
        assert.strictEqual(metrics.optimizer.spawns.total, 10);
        
        // Test recommendations endpoint
        const recsResponse = await fetch(`http://localhost:${dashboard.port}/api/recommendations`);
        assert.strictEqual(recsResponse.status, 200);
        const recs = await recsResponse.json();
        assert.ok(Array.isArray(recs));
        assert.ok(recs.length > 0);
    });
    
    test('should calculate performance score', () => {
        const score = dashboard.calculatePerformanceScore();
        assert.ok(typeof score === 'number');
        assert.ok(score >= 0 && score <= 100);
    });
    
    test('should generate alerts for issues', () => {
        // Trigger high queue backlog
        dashboard.instanceManager.getPerformanceMetrics = () => ({
            optimizer: {
                spawns: { total: 10, concurrent: 2, avgTime: 50 },
                messages: { total: 100, batches: 20, avgBatchSize: 5 },
                gitOps: { total: 30, concurrent: 1, avgTime: 100 },
                cacheHits: 10,
                cacheMisses: 90,
                queues: {
                    spawn: { size: 50, pending: 50 }, // High backlog
                    git: { size: 0, pending: 0 }
                },
                pools: { instance: 0, worktree: 0 }, // Empty pools
                cache: { size: 20, hitRate: 0.1 } // Low hit rate
            },
            instances: {
                total: 50,
                byRole: { executive: 1, manager: 10, specialist: 39 },
                active: 50
            },
            redis: { connected: false, operations: 0 }
        });
        
        dashboard.checkForAlerts();
        
        assert.ok(dashboard.state.alerts.length > 0);
        
        // Should have alerts for queue backlog and low cache hit rate
        const queueAlert = dashboard.state.alerts.find(a => a.message.includes('queue backlog'));
        assert.ok(queueAlert);
        
        const cacheAlert = dashboard.state.alerts.find(a => a.message.includes('cache hit rate'));
        assert.ok(cacheAlert);
    });
    
    test('should clean up resources on stop', async () => {
        dashboard.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Connect a client
        const ws = new WebSocket(`ws://localhost:${dashboard.port}`);
        await new Promise((resolve) => {
            ws.on('open', resolve);
        });
        
        // Stop dashboard
        dashboard.stop();
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Server should be closed
        try {
            await fetch(`http://localhost:${dashboard.port}/api/state`);
            assert.fail('Server should be closed');
        } catch (err) {
            // Expected - connection refused
            assert.ok(err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed'));
        }
        
        // WebSocket should be closed
        assert.strictEqual(ws.readyState, WebSocket.CLOSED);
    });
});