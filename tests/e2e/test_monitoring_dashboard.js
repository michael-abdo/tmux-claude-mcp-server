/**
 * Test for Monitoring Dashboard
 * 
 * Validates dashboard functionality
 */

// Import test setup first to configure mocks
import './setup/test-setup.js';

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert';
import { createMonitoringDashboard } from '../../src/monitoring_dashboard.js';
import { InstanceManagerFactory } from '../../src/factories/instance_manager_factory.js';
import WebSocket from 'ws';

describe('Monitoring Dashboard', () => {
    let dashboard;
    let testPortBase = 3456 + Math.floor(Math.random() * 1000); // Random port to avoid conflicts
    let testPortOffset = 0;
    let activeWebSockets = [];
    
    // Helper to get next available port
    const getNextPort = () => {
        return testPortBase + (testPortOffset++);
    };
    
    // Helper to track WebSocket connections
    const createTrackedWebSocket = (url) => {
        const ws = new WebSocket(url);
        activeWebSockets.push(ws);
        return ws;
    };
    
    // Helper to create mock performance monitor
    const createMockPerfMonitor = async () => {
        const { EventEmitter } = await import('events');
        return Object.assign(new EventEmitter(), {
            start: () => {},
            stop: () => {},
            getRecommendations: () => []
        });
    };
    
    // Cleanup after each test
    afterEach(async () => {
        // Close all active WebSockets
        for (const ws of activeWebSockets) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }
        activeWebSockets = [];
        
        // Stop dashboard if running
        if (dashboard) {
            dashboard.stop();
            dashboard = null;
        }
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 200));
    });
    
    test('should start dashboard server', async () => {
        const port = getNextPort();
        
        // Create mock instance manager
        const mockInstanceManager = InstanceManagerFactory.create('mock', {
            stateDir: './test-state'
        });
        
        // Set up mock data
        mockInstanceManager.instances = {
            'test_1': { instanceId: 'test_1', role: 'specialist', status: 'active' }
        };
        
        mockInstanceManager.getAllInstances = async () => {
            return Object.values(mockInstanceManager.instances);
        };
        
        mockInstanceManager.listInstances = async () => {
            return Object.values(mockInstanceManager.instances);
        };
        
        // Create dashboard with mocked dependencies
        dashboard = createMonitoringDashboard(port, {
            instanceManager: mockInstanceManager,
            performanceMonitor: await createMockPerfMonitor()
        });
        
        dashboard.start();
        
        // Wait for server to start
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test HTTP endpoint
        const response = await fetch(`http://localhost:${port}/api/state`);
        assert.strictEqual(response.status, 200);
        
        const state = await response.json();
        assert.ok('instances' in state);
        assert.ok('performance' in state);
        assert.ok('alerts' in state);
        
        dashboard.stop();
    });
    
    test('should handle WebSocket connections', { timeout: 10000 }, async (t) => {
        const port = getNextPort();
        
        // Create mock instance manager
        const mockInstanceManager = InstanceManagerFactory.create('mock', {
            stateDir: './test-state'
        });
        
        mockInstanceManager.instances = {
            'test_1': { instanceId: 'test_1', role: 'specialist', status: 'active' }
        };
        
        mockInstanceManager.getAllInstances = async () => {
            return Object.values(mockInstanceManager.instances);
        };
        
        mockInstanceManager.listInstances = async () => {
            return Object.values(mockInstanceManager.instances);
        };
        
        // Create dashboard with mocked dependencies
        dashboard = createMonitoringDashboard(port, {
            instanceManager: mockInstanceManager,
            performanceMonitor: await createMockPerfMonitor()
        });
        
        dashboard.start();
        
        // Wait longer for server to be fully ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Connect WebSocket client with timeout
        const ws = createTrackedWebSocket(`ws://localhost:${port}`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            let connected = false;
            
            ws.on('open', () => {
                connected = true;
                clearTimeout(timeout);
                resolve();
            });
            
            ws.on('error', (err) => {
                if (!connected) {
                    // Ignore connection errors during setup
                    console.log('WebSocket connection error (retrying):', err.message);
                }
            });
            
            // Also resolve if we get a message (sometimes open event is missed)
            ws.on('message', () => {
                if (!connected) {
                    connected = true;
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });
        
        // Should receive initial state with timeout (may get other messages first)
        const message = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Initial message timeout'));
            }, 5000);
            
            ws.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'initial') {
                    clearTimeout(timeout);
                    resolve(msg);
                }
                // Ignore other message types that might come first
            });
        });
        
        assert.strictEqual(message.type, 'initial');
        assert.ok(message.data);
        
        // Cleanup handled by afterEach
    });
    
    test('should broadcast performance updates', async () => {
        const port = getNextPort();
        
        // Create mock instance manager
        const mockInstanceManager = InstanceManagerFactory.create('mock', {
            stateDir: './test-state'
        });
        
        // Create mock performance monitor with event emitter capability
        const { EventEmitter } = await import('events');
        const mockPerfMonitor = new EventEmitter();
        mockPerfMonitor.start = () => {};
        mockPerfMonitor.stop = () => {};
        mockPerfMonitor.getRecommendations = () => [];
        
        // Create dashboard with mocked dependencies
        dashboard = createMonitoringDashboard(port, {
            instanceManager: mockInstanceManager,
            performanceMonitor: mockPerfMonitor
        });
        
        dashboard.start();
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const ws = createTrackedWebSocket(`ws://localhost:${port}`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 5000);
            
            ws.on('open', () => {
                clearTimeout(timeout);
                resolve();
            });
            ws.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
        
        // Wait for initial message with timeout
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Initial message timeout'));
            }, 5000);
            
            ws.once('message', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
        
        // Trigger performance update
        dashboard.performanceMonitor.emit('snapshot', {
            timestamp: Date.now(),
            instances: { total: 5 },
            optimizer: { spawns: { total: 10 } }
        });
        
        // Should receive performance update with timeout
        const perfMessage = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Performance message timeout'));
            }, 5000);
            
            ws.on('message', (data) => {
                const msg = JSON.parse(data);
                if (msg.type === 'performance') {
                    clearTimeout(timeout);
                    resolve(msg);
                }
            });
        });
        
        assert.strictEqual(perfMessage.type, 'performance');
        assert.strictEqual(perfMessage.data.instances.total, 5);
        
        // Cleanup handled by afterEach
    });
    
    test('should handle API requests', async () => {
        const port = getNextPort();
        
        // Create mock instance manager
        const mockInstanceManager = InstanceManagerFactory.create('mock', {
            stateDir: './test-state'
        });
        
        // Override getPerformanceMetrics
        mockInstanceManager.getPerformanceMetrics = () => ({
            instances: { total: 3 },
            optimizer: { spawns: { total: 15 } }
        });
        
        // Create mock performance monitor with custom recommendations
        const mockPerfMonitor = await createMockPerfMonitor();
        mockPerfMonitor.getRecommendations = () => [
            { priority: 'high', suggestion: 'Test recommendation' }
        ];
        
        // Create dashboard with mocked dependencies
        dashboard = createMonitoringDashboard(port, {
            instanceManager: mockInstanceManager,
            performanceMonitor: mockPerfMonitor
        });
        
        dashboard.start();
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test metrics endpoint
        const metricsRes = await fetch(`http://localhost:${port}/api/metrics`);
        const metrics = await metricsRes.json();
        assert.strictEqual(metrics.instances.total, 3);
        
        // Test recommendations endpoint
        const recsRes = await fetch(`http://localhost:${port}/api/recommendations`);
        const recs = await recsRes.json();
        assert.strictEqual(recs.length, 1);
        assert.strictEqual(recs[0].priority, 'high');
        
        dashboard.stop();
    });
});