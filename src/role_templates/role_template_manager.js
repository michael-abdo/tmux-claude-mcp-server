/**
 * Role Template Manager
 * Provides standardized role templates that get copied to instance directories
 */

import fs from 'fs-extra';
import path from 'path';
import { pathResolver } from '../utils/path_resolver.js';

export class RoleTemplateManager {
    constructor() {
        this.templateDir = pathResolver.templates();
    }

    /**
     * Get standardized role template content
     * @param {string} role - executive, manager, or specialist
     * @returns {string} Template content
     */
    getRoleTemplate(role) {
        const templatePath = path.join(this.templateDir, `${role}.md`);
        
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Role template not found: ${role}`);
        }

        return fs.readFileSync(templatePath, 'utf8');
    }

    /**
     * Build complete context by combining role template with project-specific content
     * @param {string} role - executive, manager, or specialist  
     * @param {string} projectContext - Project-specific instructions
     * @param {string} instanceId - Instance identifier
     * @param {object} options - Additional options like bridgePath
     * @returns {string} Complete context
     */
    buildContext(role, projectContext, instanceId, options = {}) {
        let roleTemplate = this.getRoleTemplate(role);
        
        // Perform path substitutions if bridgePath is provided
        if (options.bridgePath && (role === 'executive' || role === 'manager')) {
            // Replace all instances of ../scripts/mcp_bridge.js with absolute path
            roleTemplate = roleTemplate.replace(/\.\.\/scripts\/mcp_bridge\.js/g, options.bridgePath);
        }
        
        return `${roleTemplate}

## PROJECT-SPECIFIC CONTEXT
Instance ID: ${instanceId}

${projectContext}`;
    }

    /**
     * Save role template to instance directory
     * @param {string} instanceDir - Instance working directory
     * @param {string} role - Role type
     * @param {string} projectContext - Project-specific context
     * @param {string} instanceId - Instance ID
     * @param {object} options - Additional options like bridgePath
     */
    saveContextToInstance(instanceDir, role, projectContext, instanceId, options = {}) {
        // Ensure instance directory exists using fs-extra for consistency
        fs.ensureDirSync(instanceDir);

        const completeContext = this.buildContext(role, projectContext, instanceId, options);
        const claudeFilePath = path.join(instanceDir, 'CLAUDE.md');
        
        fs.writeFileSync(claudeFilePath, completeContext);
        
        return claudeFilePath;
    }

    /**
     * Get role-specific enforcement rules
     * @param {string} role - Role type
     * @returns {object} Enforcement configuration
     */
    getRoleEnforcement(role) {
        const enforcement = {
            executive: {
                mustDelegate: true,
                canImplement: false,
                spawnsRole: 'manager',
                verificationRequired: true,
                integrationOversight: true
            },
            manager: {
                mustDelegate: true,
                canImplement: false,
                spawnsRole: 'specialist',
                verificationRequired: true,
                integrationOversight: true
            },
            specialist: {
                mustDelegate: false,
                canImplement: true,
                spawnsRole: null,
                verificationRequired: true,
                integrationOversight: false
            }
        };

        return enforcement[role] || null;
    }

    /**
     * Validate role behavior against template requirements
     * @param {string} role - Role type
     * @param {object} behavior - Observed behavior
     * @returns {object} Validation result
     */
    validateRoleBehavior(role, behavior) {
        const enforcement = this.getRoleEnforcement(role);
        const violations = [];

        if (enforcement.mustDelegate && behavior.implementedDirectly) {
            violations.push(`${role} implemented directly instead of delegating`);
        }

        if (!enforcement.canImplement && behavior.wroteCode) {
            violations.push(`${role} wrote code but should only delegate`);
        }

        if (enforcement.verificationRequired && !behavior.verifiedCompletion) {
            violations.push(`${role} didn't verify functional completion`);
        }

        return {
            valid: violations.length === 0,
            violations: violations
        };
    }
}

export default RoleTemplateManager;