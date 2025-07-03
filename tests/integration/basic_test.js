/**
 * Basic tests for tmux-claude MCP Server
 * 
 * Tests core functionality without requiring actual tmux sessions.
 * Uses mocked tmux interface for isolated testing.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { buildClaudeMd } from '../../src/claude_md_builder.js';

// Mock TmuxInterface for testing
class MockTmuxInterface {
    constructor() {
        this.sessions = new Map();
        this.panes = new Map();
    }

    async createSession(name, cwd, detached = true) {
        this.sessions.set(name, { name, cwd, detached });
        this.panes.set(`${name}:0.0`, { content: '' });
        return true;
    }

    async killSession(name) {
        this.sessions.delete(name);
        this.panes.delete(`${name}:0.0`);
        return true;
    }

    async sendKeys(target, keys, enter = false) {
        if (this.panes.has(target)) {
            const pane = this.panes.get(target);
            pane.content += keys + (enter ? '\n' : '');
            return true;
        }
        return false;
    }

    async capturePane(target, lines = null) {
        const pane = this.panes.get(target);
        return pane ? pane.content : '';
    }

    getPaneTarget(sessionName, windowIndex = 0, paneIndex = 0) {
        return `${sessionName}:${windowIndex}.${paneIndex}`;
    }

    async isPaneActive(target) {
        return this.panes.has(target);
    }

    async sessionExists(name) {
        return this.sessions.has(name);
    }
}

test('InstanceManager can generate hierarchical instance IDs', () => {
    const manager = new InstanceManager('./test-state');
    
    const execId = manager.generateInstanceId('executive');
    assert.match(execId, /^exec_\d+$/);
    
    const mgrId = manager.generateInstanceId('manager', 'exec_123');
    assert.match(mgrId, /^mgr_123_\d+$/);
    
    const specId = manager.generateInstanceId('specialist', 'mgr_123_456');
    assert.match(specId, /^spec_123_456_\d+$/);
});

test('MCPTools validates spawn parameters', async () => {
    const manager = new InstanceManager('./test-state');
    const tools = new EnhancedMCPTools(manager);
    
    // Missing parameters should throw
    await assert.rejects(
        tools.spawn({}),
        /Missing required parameters/
    );
    
    // Invalid role should throw
    await assert.rejects(
        tools.spawn({ role: 'invalid', workDir: '/test', context: 'test' }),
        /Invalid role/
    );
    
    // Specialist caller should be rejected
    await assert.rejects(
        tools.spawn(
            { role: 'manager', workDir: '/test', context: 'test' },
            'specialist'
        ),
        /Specialists have NO access/
    );
});

test('MCPTools enforces role-based access control', async () => {
    const manager = new InstanceManager('./test-state');
    const tools = new EnhancedMCPTools(manager);
    
    // All tools should reject specialist callers
    const sendParams = { instanceId: 'test_123', text: 'test message' };
    const readParams = { instanceId: 'test_123' };
    const terminateParams = { instanceId: 'test_123' };
    
    await assert.rejects(
        tools.send(sendParams, 'specialist'),
        /Specialists have NO access/
    );
    
    await assert.rejects(
        tools.read(readParams, 'specialist'),
        /Specialists have NO access/
    );
    
    await assert.rejects(
        tools.list({}, 'specialist'),
        /Specialists have NO access/
    );
    
    await assert.rejects(
        tools.terminate(terminateParams, 'specialist'),
        /Specialists have NO access/
    );
});

test('MCPTools returns proper tool definitions', () => {
    const manager = new InstanceManager('./test-state');
    const tools = new EnhancedMCPTools(manager);
    
    const definitions = tools.getToolDefinitions();
    
    assert.equal(definitions.length, 6); // 5 core tools + restart
    
    const toolNames = definitions.map(t => t.name);
    assert.deepEqual(toolNames, ['spawn', 'send', 'read', 'list', 'terminate', 'restart']);
    
    // Check spawn tool definition
    const spawnTool = definitions.find(t => t.name === 'spawn');
    assert.ok(spawnTool);
    assert.equal(spawnTool.inputSchema.required.length, 3);
    assert.deepEqual(spawnTool.inputSchema.required, ['role', 'workDir', 'context']);
});

test('InstanceManager builds appropriate CLAUDE.md content', () => {
    // Test specialist context using canonical buildClaudeMd function
    const specialistContext = buildClaudeMd(
        'specialist', 
        'spec_1_1_1',
        '/test/workdir',
        'mgr_1_1',
        'Base context'
    );
    
    assert.match(specialistContext, /Instance Context - spec_1_1_1/);
    assert.match(specialistContext, /Role.*specialist/);
    assert.match(specialistContext, /YOUR SPECIALIST RESPONSIBILITIES/);
    assert.match(specialistContext, /Base context/);
    
    // Test manager context using canonical buildClaudeMd function
    const managerContext = buildClaudeMd(
        'manager',
        'mgr_1_1',
        '/test/workdir',
        'exec_1',
        'Base context'
    );
    
    assert.match(managerContext, /Instance Context - mgr_1_1/);
    assert.match(managerContext, /Role.*manager/);
    assert.match(managerContext, /YOUR MANAGER RESPONSIBILITIES/);
    assert.match(managerContext, /Parent Instance.*exec_1/);
});

console.log('Running basic tests for tmux-claude MCP Server...');