/**
 * Shared Workspace AI Integration
 * Integrates AI conflict resolution with git operations
 */

import { aiConflictResolver } from './ai_conflict_resolver.js';
import { sharedWorkspaceGitManager } from './shared_workspace_git_manager.js';
import fs from 'fs/promises';
import path from 'path';

export class SharedWorkspaceAIIntegration {
    constructor() {
        this.conflictResolver = aiConflictResolver;
        this.gitManager = sharedWorkspaceGitManager;
    }

    /**
     * Attempt to merge with AI-assisted conflict resolution
     * @param {Object} options - Merge options
     * @returns {Promise<Object>} Merge result
     */
    async mergeWithAI(options) {
        const { 
            workspaceDir, 
            sourceBranch, 
            targetBranch = 'master',
            aiProvider,
            autoApply = false,
            minConfidence = 0.7
        } = options;

        console.log(`🤖 Attempting AI-assisted merge: ${sourceBranch} → ${targetBranch}`);

        // First, try a regular merge
        try {
            await this.gitManager.gitCommand(`checkout ${targetBranch}`, workspaceDir);
            await this.gitManager.gitCommand(`merge ${sourceBranch} --no-edit`, workspaceDir);
            
            return {
                success: true,
                method: 'clean-merge',
                message: 'Merge completed without conflicts'
            };
        } catch (error) {
            // Check if it's a merge conflict
            if (!error.message.includes('Automatic merge failed')) {
                throw error;
            }
        }

        console.log('⚠️  Merge conflicts detected, invoking AI resolution...');

        // Get list of conflicted files
        const conflicts = await this.getConflictedFiles(workspaceDir);
        
        if (conflicts.length === 0) {
            throw new Error('Merge failed but no conflicts detected');
        }

        // Resolve each conflicted file
        const resolutions = [];
        for (const filePath of conflicts) {
            const fullPath = path.join(workspaceDir, filePath);
            
            try {
                const result = await this.conflictResolver.resolveFileConflicts(
                    fullPath,
                    workspaceDir,
                    aiProvider
                );
                
                resolutions.push({
                    file: filePath,
                    ...result
                });

                // Apply resolution if confidence is high enough and autoApply is enabled
                if (autoApply && result.confidence >= minConfidence) {
                    await fs.writeFile(fullPath, result.resolvedContent);
                    await this.gitManager.gitCommand(`add "${filePath}"`, workspaceDir);
                    console.log(`✅ Auto-applied AI resolution for ${filePath} (confidence: ${(result.confidence * 100).toFixed(1)}%)`);
                }
            } catch (error) {
                console.error(`❌ Failed to resolve ${filePath}: ${error.message}`);
                resolutions.push({
                    file: filePath,
                    success: false,
                    error: error.message
                });
            }
        }

        // Generate resolution report
        const report = this.generateMergeReport(resolutions);
        
        // If auto-apply is enabled and all resolutions are confident, complete the merge
        if (autoApply && resolutions.every(r => r.success && r.confidence >= minConfidence)) {
            await this.completeMerge(workspaceDir, sourceBranch, report);
            
            return {
                success: true,
                method: 'ai-auto-merge',
                resolutions,
                report,
                message: 'AI-assisted merge completed automatically'
            };
        }

        // Otherwise, return the resolutions for manual review
        return {
            success: false,
            method: 'ai-assisted',
            resolutions,
            report,
            message: 'AI resolutions generated for review',
            reviewRequired: true
        };
    }

    /**
     * Get list of conflicted files
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Array>} List of conflicted file paths
     */
    async getConflictedFiles(workspaceDir) {
        const stdout = await this.gitManager.gitCommand('diff --name-only --diff-filter=U', workspaceDir);
        return stdout.trim().split('\n').filter(f => f);
    }

    /**
     * Complete the merge after resolutions
     * @param {string} workspaceDir - Workspace directory
     * @param {string} sourceBranch - Source branch name
     * @param {string} report - Resolution report
     */
    async completeMerge(workspaceDir, sourceBranch, report) {
        // Save the report
        const reportPath = path.join(workspaceDir, '.git', 'AI_MERGE_REPORT.md');
        await fs.writeFile(reportPath, report);

        // Commit the merge
        const commitMessage = `merge: AI-assisted merge of ${sourceBranch}

This merge was completed with AI assistance.
See .git/AI_MERGE_REPORT.md for details.

🤖 Resolved by Claude AI`;

        await this.gitManager.gitCommand(`commit -m "${commitMessage}"`, workspaceDir);
    }

    /**
     * Generate a merge report
     * @param {Array} resolutions - Array of resolution results
     * @returns {string} Markdown report
     */
    generateMergeReport(resolutions) {
        const report = [];
        const timestamp = new Date().toISOString();
        
        report.push('# AI-Assisted Merge Report');
        report.push(`**Generated**: ${timestamp}\n`);
        
        // Summary
        const successful = resolutions.filter(r => r.success).length;
        const failed = resolutions.filter(r => !r.success).length;
        const avgConfidence = resolutions
            .filter(r => r.success)
            .reduce((sum, r) => sum + r.confidence, 0) / successful || 0;

        report.push('## Summary');
        report.push(`- **Files Processed**: ${resolutions.length}`);
        report.push(`- **Successfully Resolved**: ${successful}`);
        report.push(`- **Failed**: ${failed}`);
        report.push(`- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%\n`);

        // Details for each file
        report.push('## File Resolutions');
        
        for (const resolution of resolutions) {
            report.push(`\n### ${resolution.file}`);
            
            if (resolution.success) {
                report.push(`**Status**: ✅ Resolved`);
                report.push(`**Confidence**: ${(resolution.confidence * 100).toFixed(1)}%`);
                report.push(`**Conflicts Resolved**: ${resolution.resolutions?.length || 0}`);
                
                // Add detailed resolution info if available
                if (resolution.resolutions) {
                    for (let i = 0; i < resolution.resolutions.length; i++) {
                        const res = resolution.resolutions[i];
                        report.push(`\n#### Conflict ${i + 1} (Confidence: ${(res.confidence * 100).toFixed(1)}%)`);
                        report.push('```');
                        report.push(res.resolution);
                        report.push('```');
                    }
                }
            } else {
                report.push(`**Status**: ❌ Failed`);
                report.push(`**Error**: ${resolution.error}`);
            }
        }

        return report.join('\n');
    }

    /**
     * Review and apply AI resolutions interactively
     * @param {Object} mergeResult - Result from mergeWithAI
     * @param {Function} reviewCallback - Callback for each resolution review
     * @returns {Promise<Object>} Final merge result
     */
    async reviewAndApply(mergeResult, reviewCallback) {
        const { resolutions, workspaceDir } = mergeResult;
        const appliedResolutions = [];

        for (const resolution of resolutions) {
            if (!resolution.success) continue;

            const decision = await reviewCallback({
                file: resolution.file,
                confidence: resolution.confidence,
                resolutions: resolution.resolutions,
                resolvedContent: resolution.resolvedContent
            });

            if (decision.apply) {
                const fullPath = path.join(workspaceDir, resolution.file);
                
                // Apply any modifications from the review
                const finalContent = decision.modifiedContent || resolution.resolvedContent;
                await fs.writeFile(fullPath, finalContent);
                await this.gitManager.gitCommand(`add "${resolution.file}"`, workspaceDir);
                
                appliedResolutions.push({
                    ...resolution,
                    applied: true,
                    modified: !!decision.modifiedContent
                });
                
                console.log(`✅ Applied resolution for ${resolution.file}`);
            } else {
                appliedResolutions.push({
                    ...resolution,
                    applied: false,
                    reason: decision.reason
                });
                
                console.log(`⏭️  Skipped resolution for ${resolution.file}`);
            }
        }

        return {
            ...mergeResult,
            appliedResolutions,
            allApplied: appliedResolutions.every(r => r.applied)
        };
    }

    /**
     * Train AI on successful merge resolutions
     * @param {string} workspaceDir - Workspace directory
     * @param {Object} resolution - Successful resolution to learn from
     */
    async learnFromResolution(workspaceDir, resolution) {
        // This could be enhanced to actually train or fine-tune the AI model
        // For now, we'll save successful resolutions for future reference
        
        const learningDir = path.join(workspaceDir, '.git', 'ai-learning');
        await fs.mkdir(learningDir, { recursive: true });
        
        const timestamp = Date.now();
        const learningFile = path.join(learningDir, `resolution-${timestamp}.json`);
        
        await fs.writeFile(learningFile, JSON.stringify({
            timestamp,
            resolution,
            context: {
                projectType: await this.detectProjectType(workspaceDir),
                fileType: path.extname(resolution.file)
            }
        }, null, 2));
    }

    /**
     * Detect project type for context
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<string>} Project type
     */
    async detectProjectType(workspaceDir) {
        try {
            await fs.access(path.join(workspaceDir, 'package.json'));
            return 'node';
        } catch {}
        
        try {
            await fs.access(path.join(workspaceDir, 'requirements.txt'));
            return 'python';
        } catch {}
        
        try {
            await fs.access(path.join(workspaceDir, 'Cargo.toml'));
            return 'rust';
        } catch {}
        
        return 'unknown';
    }
}

// Export singleton instance
export const sharedWorkspaceAI = new SharedWorkspaceAIIntegration();