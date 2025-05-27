/**
 * Spawn helpers for verified instance creation
 * Ensures instances are properly initialized and understand their context
 */

/**
 * Spawn an instance with confirmation of understanding
 * @param {Object} tools - MCP tools object
 * @param {Object} params - Spawn parameters
 * @param {number} timeout - Timeout for confirmation (default 20 seconds)
 * @returns {Object} - { instanceId, status, message }
 */
async function spawnWithConfirmation(tools, params, timeout = 20000) {
    // Add confirmation instruction to context
    const enhancedContext = `${params.context}

IMPORTANT: When you have read and understood this context, immediately send a message:
"READY: ${params.role} - understood context"`;

    // Spawn the instance
    const { instanceId } = await tools.spawn({
        ...params,
        context: enhancedContext
    });
    
    // Wait for instance initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send confirmation request
    await tools.send({
        instanceId: instanceId,
        text: `Please confirm you understand your role and tasks by replying with "READY: ${params.role}"`
    });
    
    // Poll for confirmation
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            const response = await tools.read({ instanceId });
            // Check if response contains READY confirmation
            if (response?.output) {
                const output = response.output;
                if (output.includes('READY:') && output.toLowerCase().includes(params.role.toLowerCase())) {
                    // Extract the READY message
                    const readyMatch = output.match(/READY:.*$/m);
                    return { 
                        instanceId, 
                        status: 'ready',
                        message: readyMatch ? readyMatch[0] : 'READY confirmed' 
                    };
                }
            }
        } catch (error) {
            console.error(`Error reading from ${instanceId}:`, error);
        }
    }
    
    // Timeout - instance failed to confirm
    return { 
        instanceId, 
        status: 'timeout',
        message: `Instance ${instanceId} failed to confirm understanding within ${timeout}ms` 
    };
}

/**
 * Spawn multiple instances in parallel with confirmation
 * @param {Object} tools - MCP tools object
 * @param {Array} instances - Array of spawn parameters
 * @returns {Array} - Results for each instance
 */
async function spawnMultipleWithConfirmation(tools, instances) {
    // Spawn all instances
    const spawnPromises = instances.map(params => 
        tools.spawn(params).then(result => ({ ...result, params }))
    );
    
    const spawnResults = await Promise.all(spawnPromises);
    
    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Send confirmation requests to all
    const confirmPromises = spawnResults.map(({ instanceId, params }) => 
        tools.send({
            instanceId: instanceId,
            text: `Please confirm you understand your role and tasks by replying with "READY: ${params.role}"`
        })
    );
    
    await Promise.all(confirmPromises);
    
    // Poll for confirmations
    const confirmationResults = await Promise.all(
        spawnResults.map(async ({ instanceId, params }) => {
            const timeout = 20000;
            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                    const response = await tools.read({ instanceId });
                    if (response?.output && response.output.includes('READY:')) {
                        const readyMatch = response.output.match(/READY:.*$/m);
                        return { 
                            instanceId, 
                            role: params.role,
                            status: 'ready',
                            message: readyMatch ? readyMatch[0] : 'READY confirmed' 
                        };
                    }
                } catch (error) {
                    console.error(`Error reading from ${instanceId}:`, error);
                }
            }
            
            return { 
                instanceId, 
                role: params.role,
                status: 'timeout',
                message: 'Failed to confirm understanding' 
            };
        })
    );
    
    return confirmationResults;
}

/**
 * Verify an existing instance is responsive
 * @param {Object} tools - MCP tools object
 * @param {string} instanceId - Instance ID to verify
 * @returns {Object} - { responsive, lastActivity }
 */
async function verifyInstanceResponsive(tools, instanceId) {
    try {
        // Send ping message
        await tools.send({
            instanceId: instanceId,
            text: "PING: Please respond with PONG to confirm you are active"
        });
        
        // Wait and check for response
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const response = await tools.read({ instanceId });
        const pongReceived = response?.output?.includes('PONG') || false;
        
        return {
            responsive: pongReceived,
            lastActivity: pongReceived ? new Date().toISOString() : null
        };
    } catch (error) {
        return {
            responsive: false,
            lastActivity: null,
            error: error.message
        };
    }
}

export {
    spawnWithConfirmation,
    spawnMultipleWithConfirmation,
    verifyInstanceResponsive
};