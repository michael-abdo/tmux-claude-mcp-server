/**
 * Role Template Manager
 * Provides standardized role templates that get copied to instance directories
 */

import fs from 'fs';
import path from 'path';

export class RoleTemplateManager {
    constructor() {
        this.templateDir = path.join(process.cwd(), 'src', 'role_templates');
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
     * @returns {string} Complete context
     */
    buildContext(role, projectContext, instanceId) {
        const roleTemplate = this.getRoleTemplate(role);
        
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
     */
    saveContextToInstance(instanceDir, role, projectContext, instanceId) {
        // Ensure instance directory exists
        if (!fs.existsSync(instanceDir)) {
            fs.mkdirSync(instanceDir, { recursive: true });
        }

        const completeContext = this.buildContext(role, projectContext, instanceId);
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