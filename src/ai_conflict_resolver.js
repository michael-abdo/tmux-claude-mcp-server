/**
 * AI-Powered Conflict Resolution
 * Uses Claude to intelligently resolve git merge conflicts
 */

import fs from 'fs/promises';
import path from 'path';
import { GitBranchManager } from './git_branch_manager.js';

export class AIConflictResolver {
    constructor() {
        this.conflictMarkers = {
            start: '<<<<<<<',
            middle: '=======',
            end: '>>>>>>>'
        };
        this.gitManager = new GitBranchManager();
    }

    /**
     * Parse conflict markers from a file
     * @param {string} filePath - Path to conflicted file
     * @returns {Promise<Object>} Parsed conflict information
     */
    async parseConflicts(filePath) {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const conflicts = [];
        
        let inConflict = false;
        let currentConflict = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith(this.conflictMarkers.start)) {
                inConflict = true;
                currentConflict = {
                    startLine: i,
                    ours: [],
                    theirs: [],
                    oursBranch: line.substring(this.conflictMarkers.start.length).trim(),
                    inTheirs: false
                };
            } else if (line.startsWith(this.conflictMarkers.middle) && inConflict) {
                currentConflict.inTheirs = true;
            } else if (line.startsWith(this.conflictMarkers.end) && inConflict) {
                currentConflict.endLine = i;
                currentConflict.theirsBranch = line.substring(this.conflictMarkers.end.length).trim();
                conflicts.push(currentConflict);
                inConflict = false;
                currentConflict = null;
            } else if (inConflict && currentConflict) {
                if (currentConflict.inTheirs) {
                    currentConflict.theirs.push(line);
                } else {
                    currentConflict.ours.push(line);
                }
            }
        }
        
        return {
            filePath,
            conflicts,
            hasConflicts: conflicts.length > 0,
            originalContent: content,
            lines
        };
    }

    /**
     * Generate AI prompt for conflict resolution
     * @param {Object} conflict - Parsed conflict information
     * @param {Object} context - Additional context about the files and project
     * @returns {string} Prompt for AI
     */
    generateResolutionPrompt(conflict, context = {}) {
        const { filePath, projectInfo = '', fileHistory = '' } = context;
        
        return `You are helping resolve a git merge conflict. Please analyze the conflicting changes and suggest the best resolution.

File: ${filePath}
${projectInfo ? `Project Context: ${projectInfo}` : ''}
${fileHistory ? `Recent File History:\n${fileHistory}` : ''}

Conflict Details:
- Branch "${conflict.oursBranch}" (ours) contains:
\`\`\`
${conflict.ours.join('\n')}
\`\`\`

- Branch "${conflict.theirsBranch}" (theirs) contains:
\`\`\`
${conflict.theirs.join('\n')}
\`\`\`

Please provide:
1. A brief analysis of what each version is trying to accomplish
2. The recommended resolution that preserves the intent of both changes where possible
3. The exact code that should replace this conflict block

Important: Return ONLY the resolved code in a code block, no explanations or markers.`;
    }

    /**
     * Get file history for better context
     * @param {string} filePath - Path to file
     * @param {string} workDir - Working directory
     * @returns {Promise<string>} Recent commit history for the file
     */
    async getFileHistory(filePath, workDir) {
        try {
            const stdout = await this.gitManager.gitCommand(
                `log --oneline -10 -- "${path.basename(filePath)}"`,
                workDir
            );
            return stdout.trim();
        } catch {
            return '';
        }
    }

    /**
     * Get semantic understanding of the code
     * @param {string} code - Code to analyze
     * @returns {Object} Semantic analysis
     */
    analyzeCodeSemantics(code) {
        // Simple heuristics for now - could be enhanced with AST parsing
        const analysis = {
            isFunction: /function\s+\w+|const\s+\w+\s*=\s*\(|=>\s*{/.test(code),
            isClass: /class\s+\w+/.test(code),
            isImport: /import\s+.+from|require\(/.test(code),
            isExport: /export\s+(default\s+)?/.test(code),
            isTest: /test\(|describe\(|it\(|expect\(/.test(code),
            isConfig: /config|settings|options/i.test(code),
            hasComments: /\/\/|\/\*|\*\//.test(code)
        };
        
        return analysis;
    }

    /**
     * Resolve conflicts in a file using AI assistance
     * @param {string} filePath - Path to conflicted file
     * @param {string} workDir - Working directory
     * @param {Function} aiResolver - Function that calls AI (Claude) with prompt
     * @returns {Promise<Object>} Resolution result
     */
    async resolveFileConflicts(filePath, workDir, aiResolver) {
        const parsed = await this.parseConflicts(filePath);
        
        if (!parsed.hasConflicts) {
            return {
                success: false,
                message: 'No conflicts found in file'
            };
        }
        
        // Get additional context
        const fileHistory = await this.getFileHistory(filePath, workDir);
        const projectInfo = await this.getProjectContext(workDir);
        
        const resolutions = [];
        
        for (const conflict of parsed.conflicts) {
            // Analyze the semantic meaning of both versions
            const oursSemantics = this.analyzeCodeSemantics(conflict.ours.join('\n'));
            const theirsSemantics = this.analyzeCodeSemantics(conflict.theirs.join('\n'));
            
            // Generate resolution prompt
            const prompt = this.generateResolutionPrompt(conflict, {
                filePath: path.basename(filePath),
                fileHistory,
                projectInfo,
                oursSemantics,
                theirsSemantics
            });
            
            // Call AI for resolution
            const resolution = await aiResolver(prompt);
            
            resolutions.push({
                conflict,
                resolution,
                confidence: this.assessResolutionConfidence(conflict, resolution)
            });
        }
        
        // Apply resolutions
        const resolvedContent = this.applyResolutions(parsed, resolutions);
        
        return {
            success: true,
            resolvedContent,
            resolutions,
            confidence: this.calculateOverallConfidence(resolutions)
        };
    }

    /**
     * Get project context for better AI understanding
     * @param {string} workDir - Working directory
     * @returns {Promise<string>} Project context
     */
    async getProjectContext(workDir) {
        const context = [];
        
        // Check for package.json
        try {
            const packageJson = await fs.readFile(path.join(workDir, 'package.json'), 'utf-8');
            const pkg = JSON.parse(packageJson);
            context.push(`Node.js project: ${pkg.name || 'unnamed'}`);
            if (pkg.description) context.push(`Description: ${pkg.description}`);
        } catch {}
        
        // Check for README
        try {
            const readme = await fs.readFile(path.join(workDir, 'README.md'), 'utf-8');
            const firstLine = readme.split('\n')[0];
            if (firstLine) context.push(`README: ${firstLine}`);
        } catch {}
        
        return context.join('\n');
    }

    /**
     * Assess confidence in AI resolution
     * @param {Object} conflict - Original conflict
     * @param {string} resolution - AI resolution
     * @returns {number} Confidence score 0-1
     */
    assessResolutionConfidence(conflict, resolution) {
        let confidence = 0.5; // Base confidence
        
        // Higher confidence if resolution includes elements from both sides
        const resolutionLower = resolution.toLowerCase();
        const oursText = conflict.ours.join(' ').toLowerCase();
        const theirsText = conflict.theirs.join(' ').toLowerCase();
        
        // Check for significant content overlap
        const hasOursContent = oursText.split(' ').some(word => 
            word.length > 3 && resolutionLower.includes(word)
        );
        const hasTheirsContent = theirsText.split(' ').some(word => 
            word.length > 3 && resolutionLower.includes(word)
        );
        
        if (hasOursContent || hasTheirsContent) {
            confidence += 0.2;
        }
        
        // Lower confidence for very different resolutions
        if (resolution.length < Math.min(oursText.length, theirsText.length) / 2) {
            confidence -= 0.3;
        }
        
        // Very low confidence for completely unrelated content
        if (!hasOursContent && !hasTheirsContent) {
            confidence = 0.2;
        }
        
        // Higher confidence for preserving structure
        const oursLines = conflict.ours.length;
        const theirsLines = conflict.theirs.length;
        const resolutionLines = resolution.split('\n').length;
        
        if (resolutionLines >= Math.min(oursLines, theirsLines) && 
            resolutionLines <= Math.max(oursLines, theirsLines)) {
            confidence += 0.1;
        }
        
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Calculate overall confidence for all resolutions
     * @param {Array} resolutions - Array of resolutions
     * @returns {number} Overall confidence 0-1
     */
    calculateOverallConfidence(resolutions) {
        if (resolutions.length === 0) return 0;
        
        const sum = resolutions.reduce((acc, r) => acc + r.confidence, 0);
        return sum / resolutions.length;
    }

    /**
     * Apply resolutions to create final file content
     * @param {Object} parsed - Parsed file with conflicts
     * @param {Array} resolutions - Array of resolutions
     * @returns {string} Resolved file content
     */
    applyResolutions(parsed, resolutions) {
        const lines = [...parsed.lines];
        
        // Apply resolutions in reverse order to maintain line numbers
        for (let i = resolutions.length - 1; i >= 0; i--) {
            const { conflict, resolution } = resolutions[i];
            const resolvedLines = resolution.split('\n');
            
            // Remove conflict markers and content
            lines.splice(
                conflict.startLine,
                conflict.endLine - conflict.startLine + 1,
                ...resolvedLines
            );
        }
        
        return lines.join('\n');
    }

    /**
     * Create a conflict resolution report
     * @param {Object} result - Resolution result
     * @returns {string} Markdown report
     */
    generateReport(result) {
        const report = [];
        
        report.push('# AI Conflict Resolution Report\n');
        report.push(`**Confidence Level**: ${(result.confidence * 100).toFixed(1)}%\n`);
        report.push(`**Conflicts Resolved**: ${result.resolutions.length}\n`);
        
        for (let i = 0; i < result.resolutions.length; i++) {
            const { conflict, resolution, confidence } = result.resolutions[i];
            
            report.push(`## Conflict ${i + 1}`);
            report.push(`**Confidence**: ${(confidence * 100).toFixed(1)}%\n`);
            report.push('**Original (Ours)**:');
            report.push('```');
            report.push(conflict.ours.join('\n'));
            report.push('```\n');
            report.push('**Incoming (Theirs)**:');
            report.push('```');
            report.push(conflict.theirs.join('\n'));
            report.push('```\n');
            report.push('**AI Resolution**:');
            report.push('```');
            report.push(resolution);
            report.push('```\n');
        }
        
        return report.join('\n');
    }
}

// Export singleton instance
export const aiConflictResolver = new AIConflictResolver();