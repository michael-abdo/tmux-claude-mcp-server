#!/usr/bin/env node

/**
 * MCP Configuration Generator
 * 
 * Generates proper .config/claude/mcp_settings.json for each Claude instance
 * to enable orchestration tools based on their role.
 * 
 * From architecture docs: "All communication between instances via MCP tools"
 */

import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export class MCPConfigGenerator {
    constructor() {
        // Use absolute path to the MCP server
        this.serverPath = path.resolve('/Users/Mike/.claude/user/tmux-claude-mcp-server/src/simple_mcp_server.js');
    }

    /**
     * Generate MCP configuration for an instance based on its role
     * @param {Object} options - Configuration options
     * @param {string} options.instanceId - Instance ID
     * @param {string} options.role - Instance role (executive, manager, specialist)
     * @param {string} options.workDir - Working directory for the instance
     * @param {string} options.parentId - Parent instance ID (optional)
     * @returns {Promise<string>} Path to generated config file
     */
    async generateConfig(options) {
        const { instanceId, role, workDir, parentId } = options;
        
        // Create .claude directory in work dir for project settings
        const configDir = path.join(workDir, '.claude');
        await fs.ensureDir(configDir);
        
        // Generate configuration based on role
        const config = this.createConfigForRole(instanceId, role, parentId);
        
        // Write to project settings file that Claude will automatically read
        const configPath = path.join(configDir, 'settings.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
        
        console.log(`Generated MCP config for ${instanceId} at ${configPath}`);
        return configPath;
    }

    /**
     * Create MCP configuration based on instance role
     * @param {string} instanceId - Instance ID
     * @param {string} role - Instance role
     * @param {string} parentId - Parent instance ID
     * @returns {Object} MCP configuration
     */
    createConfigForRole(instanceId, role, parentId) {
        const baseConfig = {
            mcpServers: {
                "tmux-claude": {
                    command: "node",
                    args: [this.serverPath],
                    env: {
                        INSTANCE_ID: instanceId,
                        INSTANCE_ROLE: role,
                        PARENT_ID: parentId || "",
                        NODE_ENV: "production"
                    }
                }
            }
        };

        // Role-specific configurations
        switch (role) {
            case 'executive':
                // Executive has full orchestration capabilities
                baseConfig.mcpServers["tmux-claude"].env.ALLOWED_TOOLS = JSON.stringify([
                    "spawn", "send", "read", "list", "terminate",
                    "executeParallel", "distributeWork", "monitorHealth"
                ]);
                baseConfig.mcpServers["tmux-claude"].env.MAX_INSTANCES = "10";
                break;
                
            case 'manager':
                // Manager can orchestrate specialists
                baseConfig.mcpServers["tmux-claude"].env.ALLOWED_TOOLS = JSON.stringify([
                    "spawn", "send", "read", "list", "terminate"
                ]);
                baseConfig.mcpServers["tmux-claude"].env.MAX_INSTANCES = "5";
                baseConfig.mcpServers["tmux-claude"].env.SPAWN_ROLE_LIMIT = "specialist";
                break;
                
            case 'specialist':
                // Specialist has NO orchestration tools - critical requirement
                baseConfig.mcpServers["tmux-claude"].env.ALLOWED_TOOLS = JSON.stringify([]);
                baseConfig.mcpServers["tmux-claude"].env.ORCHESTRATION_DISABLED = "true";
                break;
                
            default:
                throw new Error(`Unknown role: ${role}`);
        }

        // Add common environment variables
        baseConfig.mcpServers["tmux-claude"].env.PHASE = process.env.PHASE || "3";
        baseConfig.mcpServers["tmux-claude"].env.STATE_DIR = path.resolve('/Users/Mike/.claude/user/tmux-claude-mcp-server/state');
        
        // Add permissions from user settings to allow file operations
        baseConfig.permissions = {
            "allow": [
                "Bash(*)",
                "Read(*)",
                "Write(*)",
                "Edit(*)",
                "MultiEdit(*)",
                "Glob(*)",
                "Grep(*)",
                "LS(*)",
                "NotebookRead(*)",
                "NotebookEdit(*)",
                "WebFetch(*)",
                "TodoRead(*)",
                "TodoWrite(*)"
            ],
            "deny": []
        };
        
        return baseConfig;
    }

    /**
     * Update existing config file with new settings
     * @param {string} configPath - Path to config file
     * @param {Object} updates - Updates to apply
     */
    async updateConfig(configPath, updates) {
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            
            // Deep merge updates
            this.deepMerge(config, updates);
            
            await fs.writeFile(configPath, JSON.stringify(config, null, 2));
            console.log(`Updated MCP config at ${configPath}`);
        } catch (error) {
            console.error(`Error updating config: ${error.message}`);
            throw error;
        }
    }

    /**
     * Deep merge helper
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     */
    deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                this.deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /**
     * Validate MCP configuration
     * @param {string} configPath - Path to config file
     * @returns {Promise<boolean>} True if valid
     */
    async validateConfig(configPath) {
        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            
            // Check required fields
            if (!config.mcpServers || !config.mcpServers["tmux-claude"]) {
                throw new Error('Missing tmux-claude server configuration');
            }
            
            const serverConfig = config.mcpServers["tmux-claude"];
            if (!serverConfig.command || !serverConfig.args || !serverConfig.env) {
                throw new Error('Incomplete server configuration');
            }
            
            return true;
        } catch (error) {
            console.error(`Invalid config: ${error.message}`);
            return false;
        }
    }

    /**
     * Get config path for an instance
     * @param {string} workDir - Working directory
     * @returns {string} Config file path
     */
    getConfigPath(workDir) {
        return path.join(workDir, '.claude', 'settings.json');
    }
}

// Export singleton instance
export const mcpConfigGenerator = new MCPConfigGenerator();