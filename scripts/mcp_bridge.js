#!/usr/bin/env node
/**
 * MCP Bridge - Allows executives to use MCP tools via Bash
 * 
 * Usage:
 *   node mcp_bridge.js spawn '{"role":"manager","workDir":".","context":"..."}'
 *   node mcp_bridge.js list '{}'
 *   node mcp_bridge.js send '{"instanceId":"mgr_123","text":"Hello"}'
 *   node mcp_bridge.js read '{"instanceId":"mgr_123"}'
 *   node mcp_bridge.js terminate '{"instanceId":"mgr_123"}'
 */

import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';
import { InstanceManager } from '../src/instance_manager.js';
import RoleTemplateManager from '../src/role_templates/role_template_manager.js';

// CRITICAL FIX: Add timeout wrapper to prevent hanging bridge operations
function withTimeout(promise, timeoutMs = 30000, operation = 'operation') {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error(`Timeout after ${timeoutMs}ms for ${operation}`));
        }, timeoutMs);
        
        promise
            .then(resolve)
            .catch(reject)
            .finally(() => clearTimeout(timeout));
    });
}

async function main() {
    const command = process.argv[2];
    const params = JSON.parse(process.argv[3] || '{}');
    
    if (!command) {
        console.error('Usage: node mcp_bridge.js <command> <params>');
        console.error('Commands: spawn, list, send, read, terminate');
        process.exit(1);
    }
    
    try {
        const manager = new InstanceManager('./state', { silent: true });
        await manager.loadInstances();
        const tools = new EnhancedMCPTools(manager);
        const roleTemplateManager = new RoleTemplateManager();
        
        let result;
        
        switch(command) {
            case 'spawn':
                if (!params.role || !params.workDir || !params.context) {
                    throw new Error('spawn requires: role, workDir, context');
                }
                
                // Generate instance ID
                const instanceId = `${params.role.substring(0,3)}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
                
                // Build context using role template + project-specific context
                const bridgePath = new URL(import.meta.url).pathname;
                const completeContext = roleTemplateManager.buildContext(
                    params.role, 
                    params.context, 
                    instanceId,
                    { bridgePath }
                );
                
                // Update params with complete context
                const enhancedParams = {
                    ...params,
                    context: completeContext
                };
                
                result = await tools.spawn(enhancedParams, 'executive');
                // Extract instance ID from response
                const responseText = JSON.stringify(result);
                const instanceMatch = responseText.match(/(exec|mgr|spec)_\\d+/);
                if (instanceMatch) {
                    console.log(JSON.stringify({
                        success: true,
                        instanceId: instanceMatch[0].replace(/\\\\/g, ''),
                        message: 'Instance spawned successfully'
                    }));
                } else {
                    console.log(JSON.stringify({
                        success: true,
                        result: result,
                        message: 'Instance spawned'
                    }));
                }
                break;
                
            case 'list':
                result = await tools.list(params, 'executive');
                // The list method returns an array of instances directly
                console.log(JSON.stringify({
                    success: true,
                    instances: result,
                    count: result.length
                }));
                break;
                
            case 'send':
                if (!params.instanceId || !params.text) {
                    throw new Error('send requires: instanceId, text');
                }
                result = await tools.send(params, 'executive');
                console.log(JSON.stringify({
                    success: true,
                    message: 'Message sent',
                    result: result
                }));
                break;
                
            case 'read':
                if (!params.instanceId) {
                    throw new Error('read requires: instanceId');
                }
                // CRITICAL: Wrap read operation with timeout to prevent hanging
                result = await withTimeout(
                    tools.read(params, 'executive'),
                    10000, // 10 second timeout for read operations
                    `reading from instance ${params.instanceId}`
                );
                console.log(JSON.stringify({
                    success: true,
                    output: result.output || result.content?.[0]?.text || result
                }));
                break;
                
            case 'terminate':
                if (!params.instanceId) {
                    throw new Error('terminate requires: instanceId');
                }
                result = await tools.terminate(params, 'executive');
                console.log(JSON.stringify({
                    success: true,
                    message: 'Instance terminated',
                    result: result
                }));
                break;
                
            default:
                throw new Error(`Unknown command: ${command}`);
        }
        
    } catch (error) {
        console.log(JSON.stringify({
            success: false,
            error: error.message
        }));
        process.exit(1);
    }
}

main().catch(error => {
    console.log(JSON.stringify({
        success: false,
        error: error.message
    }));
    process.exit(1);
});