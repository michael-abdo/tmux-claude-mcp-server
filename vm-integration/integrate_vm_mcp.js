/**
 * VM MCP Integration - Adds VM management tools to the main MCP server
 * 
 * This module extends the existing MCP server with VM management capabilities
 * allowing Claude instances to manage cloud development environments
 */

import { VMMCPTools } from './vm_mcp_tools.js';

/**
 * Integrate VM management tools with existing MCP server
 * @param {Object} mcpServer - The existing MCP server instance
 * @param {Object} options - VM integration options
 */
export function integrateVMTools(mcpServer, options = {}) {
  const vmTools = new VMMCPTools(options);
  
  // Get VM tool definitions
  const vmToolDefinitions = vmTools.getToolDefinitions();
  
  // Add VM tools to MCP server
  for (const toolDef of vmToolDefinitions) {
    mcpServer.tools[toolDef.name] = {
      ...toolDef,
      handler: async (params) => {
        try {
          const result = await vmTools.executeTool(toolDef.name, params);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text', 
              text: JSON.stringify({
                success: false,
                error: error.message,
                message: `VM tool '${toolDef.name}' failed`
              }, null, 2)
            }]
          };
        }
      }
    };
  }
  
  console.log(`✅ Integrated ${vmToolDefinitions.length} VM management tools`);
  
  return {
    toolsAdded: vmToolDefinitions.length,
    tools: vmToolDefinitions.map(t => t.name)
  };
}

/**
 * Example usage for adding VM tools to the main MCP server
 */
export function setupVMIntegration() {
  return {
    integrateWithServer: integrateVMTools,
    vmToolsCount: 9,
    features: [
      'vm_create - Create new VM instances',
      'vm_list - List all VM instances', 
      'vm_start - Start stopped instances',
      'vm_stop - Stop running instances',
      'vm_terminate - Permanently delete instances',
      'vm_status - Get detailed instance status',
      'vm_ssh - Get SSH connection information',
      'vm_create_image - Create AMI templates',
      'vm_bulk_create - Create multiple instances'
    ]
  };
}

export default { integrateVMTools, setupVMIntegration };