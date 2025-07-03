/**
 * PathResolver - Provides portable path resolution for tmux-claude-mcp-server
 * 
 * Enables the system to run from any directory by automatically detecting the
 * project root and resolving paths relative to it.
 * 
 * Key features:
 * - Automatic project root detection using package.json markers
 * - Fallback using __dirname navigation from known project files
 * - Convenience methods for common directories (state, templates, workflows)
 * - Backward compatible with existing relative path usage
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export class PathResolver {
    constructor() {
        this.projectRoot = null;
        this.initialized = false;
    }

    /**
     * Initialize the path resolver by detecting project root
     */
    init() {
        if (this.initialized) return;
        
        this.projectRoot = this.findProjectRoot();
        this.initialized = true;
        
        if (!this.projectRoot) {
            throw new Error('Could not detect tmux-claude-mcp-server project root');
        }
    }

    /**
     * Find the project root directory using multiple detection strategies
     * @returns {string} Absolute path to project root
     */
    findProjectRoot() {
        // Strategy 1: Look for package.json with our project name
        const currentDir = process.cwd();
        let dir = currentDir;
        
        // Walk up from current directory
        for (let i = 0; i < 10; i++) {
            const packageJsonPath = path.join(dir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                    if (packageJson.name === 'tmux-claude-mcp-server' || 
                        (packageJson.description && packageJson.description.includes('tmux-claude-mcp-server'))) {
                        return dir;
                    }
                } catch (error) {
                    // Ignore JSON parse errors, continue search
                }
            }
            
            const parentDir = path.dirname(dir);
            if (parentDir === dir) break; // Reached filesystem root
            dir = parentDir;
        }

        // Strategy 2: Use known file structure to detect project root
        // Find where this PathResolver file is located and navigate up
        const currentFileUrl = import.meta.url;
        const currentFilePath = fileURLToPath(currentFileUrl);
        
        // currentFilePath should be: {project}/src/utils/path_resolver.js
        // So project root is 2 levels up
        const pathFromFileLocation = path.resolve(path.dirname(currentFilePath), '..', '..');
        
        if (this.isValidProjectRoot(pathFromFileLocation)) {
            return pathFromFileLocation;
        }

        // Strategy 3: Look for distinctive project markers from current directory
        dir = currentDir;
        for (let i = 0; i < 10; i++) {
            if (this.isValidProjectRoot(dir)) {
                return dir;
            }
            
            const parentDir = path.dirname(dir);
            if (parentDir === dir) break;
            dir = parentDir;
        }

        // Strategy 4: Fallback - if we're running from inside the project structure
        // Look for src/, scripts/, workflows/ directories as markers
        dir = currentDir;
        for (let i = 0; i < 10; i++) {
            const hasSrc = fs.existsSync(path.join(dir, 'src'));
            const hasScripts = fs.existsSync(path.join(dir, 'scripts'));
            const hasWorkflows = fs.existsSync(path.join(dir, 'workflows'));
            
            if (hasSrc && hasScripts && hasWorkflows) {
                return dir;
            }
            
            const parentDir = path.dirname(dir);
            if (parentDir === dir) break;
            dir = parentDir;
        }

        return null;
    }

    /**
     * Check if a directory contains the expected project structure
     * @param {string} dir - Directory to check
     * @returns {boolean} True if this looks like the project root
     */
    isValidProjectRoot(dir) {
        const requiredDirs = ['src', 'scripts', 'workflows'];
        const requiredFiles = ['src/instance_manager.js', 'scripts/mcp_bridge.js'];
        
        // Check for required directories
        for (const requiredDir of requiredDirs) {
            if (!fs.existsSync(path.join(dir, requiredDir))) {
                return false;
            }
        }
        
        // Check for specific key files
        for (const requiredFile of requiredFiles) {
            if (!fs.existsSync(path.join(dir, requiredFile))) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Resolve a path relative to the project root
     * @param {...string} pathSegments - Path segments to join with project root
     * @returns {string} Absolute path
     */
    resolve(...pathSegments) {
        this.init();
        return path.resolve(this.projectRoot, ...pathSegments);
    }

    /**
     * Get the project root directory
     * @returns {string} Absolute path to project root
     */
    getProjectRoot() {
        this.init();
        return this.projectRoot;
    }

    /**
     * Get the state directory path
     * @returns {string} Absolute path to state directory
     */
    state() {
        return this.resolve('state');
    }

    /**
     * Get the role templates directory path  
     * @returns {string} Absolute path to role templates directory
     */
    templates() {
        return this.resolve('src', 'role_templates');
    }

    /**
     * Get the workflows directory path
     * @returns {string} Absolute path to workflows directory
     */
    workflows() {
        return this.resolve('workflows');
    }

    /**
     * Get the scripts directory path
     * @returns {string} Absolute path to scripts directory
     */
    scripts() {
        return this.resolve('scripts');
    }

    /**
     * Get the src directory path
     * @returns {string} Absolute path to src directory
     */
    src() {
        return this.resolve('src');
    }

    /**
     * Get the docs directory path
     * @returns {string} Absolute path to docs directory
     */
    docs() {
        return this.resolve('docs');
    }

    /**
     * Get path to specific state file
     * @param {string} filename - State filename
     * @returns {string} Absolute path to state file
     */
    stateFile(filename) {
        return this.resolve('state', filename);
    }

    /**
     * Get path to specific role template
     * @param {string} role - Role name (executive, manager, specialist)
     * @returns {string} Absolute path to role template
     */
    template(role) {
        return this.resolve('src', 'role_templates', `${role}.md`);
    }

    /**
     * Get path to specific workflow file
     * @param {string} workflowPath - Workflow file path relative to workflows dir
     * @returns {string} Absolute path to workflow file
     */
    workflow(workflowPath) {
        return this.resolve('workflows', workflowPath);
    }

    /**
     * Check if the resolver has been properly initialized
     * @returns {boolean} True if initialized and project root found
     */
    isInitialized() {
        return this.initialized && this.projectRoot !== null;
    }

    /**
     * Get debug information about the path resolver
     * @returns {object} Debug information
     */
    getDebugInfo() {
        return {
            initialized: this.initialized,
            projectRoot: this.projectRoot,
            currentWorkingDirectory: process.cwd(),
            currentFileLocation: fileURLToPath(import.meta.url),
            isValidRoot: this.projectRoot ? this.isValidProjectRoot(this.projectRoot) : false
        };
    }
}

// Create singleton instance
export const pathResolver = new PathResolver();

// Export as default for convenience
export default pathResolver;