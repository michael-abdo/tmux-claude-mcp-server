/**
 * Shared Validation Utilities
 * 
 * Consolidates validation logic used across MCP tools and instance management.
 * Eliminates code duplication and ensures consistent error messages.
 */

export class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

export class Validator {
    /**
     * Validate role parameter
     */
    static validateRole(role) {
        if (!['executive', 'manager', 'specialist'].includes(role)) {
            throw new ValidationError('Invalid role. Must be: executive, manager, or specialist');
        }
    }

    /**
     * Validate workspace mode
     */
    static validateWorkspaceMode(workspaceMode) {
        if (!['isolated', 'shared'].includes(workspaceMode)) {
            throw new ValidationError('Invalid workspaceMode. Must be: isolated or shared');
        }
    }

    /**
     * Check specialist access control
     */
    static checkSpecialistAccess(callerRole) {
        if (callerRole === 'specialist') {
            throw new ValidationError('Specialists have NO access to MCP orchestration tools');
        }
    }

    /**
     * Validate required parameters
     */
    static validateRequired(params, requiredFields) {
        const missing = [];
        for (const field of requiredFields) {
            if (!params[field]) {
                missing.push(field);
            }
        }
        if (missing.length > 0) {
            throw new ValidationError(`Missing required parameters: ${missing.join(', ')}`);
        }
    }

    /**
     * Validate spawn parameters
     */
    static validateSpawnParams(params) {
        this.validateRequired(params, ['role', 'workDir', 'context']);
        this.validateRole(params.role);
        if (params.workspaceMode) {
            this.validateWorkspaceMode(params.workspaceMode);
        }
    }

    /**
     * Validate send parameters
     */
    static validateSendParams(params) {
        this.validateRequired(params, ['instanceId', 'text']);
    }

    /**
     * Validate read parameters
     */
    static validateReadParams(params) {
        this.validateRequired(params, ['instanceId']);
    }

    /**
     * Validate terminate parameters
     */
    static validateTerminateParams(params) {
        this.validateRequired(params, ['instanceId']);
    }

    /**
     * Validate git/workspace parameters
     */
    static validateWorkspaceParams(params, requiredFields = ['workspace_dir']) {
        this.validateRequired(params, requiredFields);
    }

    /**
     * Validate manager ID parameter
     */
    static validateManagerId(managerId) {
        if (!managerId) {
            throw new ValidationError('Missing required parameter: managerId');
        }
    }

    /**
     * Validate instance ID parameter
     */
    static validateInstanceId(instanceId) {
        if (!instanceId) {
            throw new ValidationError('Missing required parameter: instanceId');
        }
    }
}