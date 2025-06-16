#!/usr/bin/env node

/**
 * Comprehensive Integration Tester for Claude Code Orchestration Platform
 * Tests all system components and their interactions
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class IntegrationTester {
    constructor() {
        this.testSuite = [];
        this.results = [];
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.timeout = 30000; // 30 seconds per test
    }

    async runAllTests() {
        console.log('🧪 Claude Code Integration Test Suite');
        console.log(''.padEnd(60, '='));
        console.log('');

        this.setupTestSuite();
        
        let passed = 0;
        let failed = 0;
        
        for (const test of this.testSuite) {
            console.log(`🔄 Running: ${test.name}`);
            
            try {
                const startTime = Date.now();
                const result = await this.runTest(test);
                const duration = Date.now() - startTime;
                
                if (result.success) {
                    console.log(`✅ PASS: ${test.name} (${duration}ms)`);
                    passed++;
                } else {
                    console.log(`❌ FAIL: ${test.name} - ${result.error}`);
                    failed++;
                }
                
                this.results.push({
                    ...result,
                    name: test.name,
                    duration,
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                console.log(`❌ ERROR: ${test.name} - ${error.message}`);
                failed++;
                this.results.push({
                    name: test.name,
                    success: false,
                    error: error.message,
                    duration: 0,
                    timestamp: new Date().toISOString()
                });
            }
            
            console.log('');
        }
        
        this.displaySummary(passed, failed);
        await this.saveResults();
        
        return { passed, failed, total: this.testSuite.length, results: this.results };
    }

    setupTestSuite() {
        this.testSuite = [
            {
                name: 'Git Repository Health',
                type: 'system',
                test: this.testGitHealth.bind(this)
            },
            {
                name: 'Instance State Management',
                type: 'instances',
                test: this.testInstanceState.bind(this)
            },
            {
                name: 'MCP Bridge Connectivity',
                type: 'mcp',
                test: this.testMCPBridge.bind(this)
            },
            {
                name: 'Workflow Engine Functionality',
                type: 'workflows',
                test: this.testWorkflowEngine.bind(this)
            },
            {
                name: 'Tmux Session Management',
                type: 'tmux',
                test: this.testTmuxSessions.bind(this)
            },
            {
                name: 'VM Integration Scripts',
                type: 'vm',
                test: this.testVMIntegration.bind(this)
            },
            {
                name: 'Performance Monitoring',
                type: 'monitoring',
                test: this.testPerformanceMonitoring.bind(this)
            },
            {
                name: 'File System Integrity',
                type: 'filesystem',
                test: this.testFileSystemIntegrity.bind(this)
            },
            {
                name: 'Documentation Completeness',
                type: 'docs',
                test: this.testDocumentation.bind(this)
            },
            {
                name: 'Configuration Validation',
                type: 'config',
                test: this.testConfiguration.bind(this)
            }
        ];
    }

    async runTest(test) {
        return new Promise(async (resolve) => {
            const timer = setTimeout(() => {
                resolve({ success: false, error: 'Test timeout' });
            }, this.timeout);

            try {
                const result = await test.test();
                clearTimeout(timer);
                resolve(result);
            } catch (error) {
                clearTimeout(timer);
                resolve({ success: false, error: error.message });
            }
        });
    }

    // Individual Test Implementations

    async testGitHealth() {
        try {
            // Check git status
            const status = await this.execCommand('git status --porcelain');
            const branch = await this.execCommand('git branch --show-current');
            const remotes = await this.execCommand('git remote -v');
            
            // Check for git repository validity
            const isRepo = await this.execCommand('git rev-parse --is-inside-work-tree 2>/dev/null || echo "false"');
            
            if (isRepo.trim() === 'false') {
                return { success: false, error: 'Not a valid git repository' };
            }
            
            // Check for critical git issues
            const gitDir = await this.execCommand('ls -la .git 2>/dev/null | wc -l');
            if (parseInt(gitDir.trim()) === 0) {
                return { success: false, error: 'Git directory not found' };
            }
            
            return {
                success: true,
                details: {
                    branch: branch.trim(),
                    hasChanges: status.trim().length > 0,
                    remoteCount: remotes.trim().split('\n').length
                }
            };
        } catch (error) {
            return { success: false, error: `Git health check failed: ${error.message}` };
        }
    }

    async testInstanceState() {
        try {
            if (!fs.existsSync(this.stateFile)) {
                return { success: false, error: 'Instance state file not found' };
            }
            
            const stateData = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            
            if (!stateData.instances) {
                return { success: false, error: 'Invalid state file structure' };
            }
            
            const instances = Object.values(stateData.instances);
            const validInstances = instances.filter(inst => 
                inst.instanceId && 
                inst.role && 
                inst.status && 
                inst.created
            );
            
            if (validInstances.length !== instances.length) {
                return { success: false, error: 'Some instances have invalid structure' };
            }
            
            return {
                success: true,
                details: {
                    totalInstances: instances.length,
                    validInstances: validInstances.length,
                    activeInstances: instances.filter(i => i.status === 'active').length
                }
            };
        } catch (error) {
            return { success: false, error: `Instance state test failed: ${error.message}` };
        }
    }

    async testMCPBridge() {
        try {
            const bridgePath = path.join(__dirname, 'mcp_bridge.js');
            
            if (!fs.existsSync(bridgePath)) {
                return { success: false, error: 'MCP bridge script not found' };
            }
            
            // Test bridge list command with timeout
            const listResult = await this.execCommand('timeout 10s node scripts/mcp_bridge.js list \'{}\' 2>/dev/null || echo "timeout"');
            
            if (listResult.trim() === 'timeout') {
                return { success: false, error: 'MCP bridge command timed out' };
            }
            
            // Try to parse the result as JSON
            try {
                const parsed = JSON.parse(listResult);
                return {
                    success: true,
                    details: {
                        bridgeResponsive: true,
                        responseSize: listResult.length
                    }
                };
            } catch (parseError) {
                return { success: false, error: 'MCP bridge returned invalid JSON' };
            }
        } catch (error) {
            return { success: false, error: `MCP bridge test failed: ${error.message}` };
        }
    }

    async testWorkflowEngine() {
        try {
            const workflowPath = path.join(__dirname, '../src/workflow/workflow_engine.cjs');
            const workflowDir = path.join(__dirname, '../workflows/examples');
            
            if (!fs.existsSync(workflowPath)) {
                return { success: false, error: 'Workflow engine not found' };
            }
            
            if (!fs.existsSync(workflowDir)) {
                return { success: false, error: 'Workflow examples directory not found' };
            }
            
            const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yaml'));
            
            if (workflowFiles.length === 0) {
                return { success: false, error: 'No workflow files found' };
            }
            
            // Test workflow file syntax
            const testWorkflow = path.join(workflowDir, workflowFiles[0]);
            const content = fs.readFileSync(testWorkflow, 'utf8');
            
            // Basic YAML structure validation
            if (!content.includes('name:') || !content.includes('stages:')) {
                return { success: false, error: 'Invalid workflow file structure' };
            }
            
            return {
                success: true,
                details: {
                    engineExists: true,
                    workflowCount: workflowFiles.length,
                    exampleWorkflow: workflowFiles[0]
                }
            };
        } catch (error) {
            return { success: false, error: `Workflow engine test failed: ${error.message}` };
        }
    }

    async testTmuxSessions() {
        try {
            // Check if tmux is available
            const tmuxVersion = await this.execCommand('tmux -V 2>/dev/null || echo "not found"');
            
            if (tmuxVersion.includes('not found')) {
                return { success: false, error: 'Tmux not installed or not in PATH' };
            }
            
            // Check active sessions
            const sessions = await this.execCommand('tmux list-sessions 2>/dev/null || echo "no sessions"');
            const sessionCount = sessions.includes('no sessions') ? 0 : sessions.trim().split('\n').length;
            
            // Check for Claude-specific sessions
            const claudeSessions = await this.execCommand('tmux list-sessions 2>/dev/null | grep "claude_" | wc -l || echo "0"');
            const claudeSessionCount = parseInt(claudeSessions.trim()) || 0;
            
            return {
                success: true,
                details: {
                    tmuxVersion: tmuxVersion.trim(),
                    totalSessions: sessionCount,
                    claudeSessions: claudeSessionCount
                }
            };
        } catch (error) {
            return { success: false, error: `Tmux session test failed: ${error.message}` };
        }
    }

    async testVMIntegration() {
        try {
            const vmDir = path.join(__dirname, '../vm-integration');
            
            if (!fs.existsSync(vmDir)) {
                return { success: false, error: 'VM integration directory not found' };
            }
            
            const scriptsDir = path.join(vmDir, 'setup-scripts');
            const docsDir = path.join(vmDir, 'docs');
            const examplesDir = path.join(vmDir, 'examples');
            
            const scriptsExist = fs.existsSync(scriptsDir);
            const docsExist = fs.existsSync(docsDir);
            const examplesExist = fs.existsSync(examplesDir);
            
            if (!scriptsExist || !docsExist || !examplesExist) {
                return { success: false, error: 'Missing VM integration directories' };
            }
            
            const scriptCount = fs.readdirSync(scriptsDir).length;
            const docCount = fs.readdirSync(docsDir).length;
            const exampleCount = fs.readdirSync(examplesDir).length;
            
            return {
                success: true,
                details: {
                    scriptsCount: scriptCount,
                    docsCount: docCount,
                    examplesCount: exampleCount
                }
            };
        } catch (error) {
            return { success: false, error: `VM integration test failed: ${error.message}` };
        }
    }

    async testPerformanceMonitoring() {
        try {
            const monitorPath = path.join(__dirname, 'system_monitor.cjs');
            const optimizerPath = path.join(__dirname, 'performance_optimizer.cjs');
            
            if (!fs.existsSync(monitorPath)) {
                return { success: false, error: 'System monitor script not found' };
            }
            
            if (!fs.existsSync(optimizerPath)) {
                return { success: false, error: 'Performance optimizer script not found' };
            }
            
            // Test if scripts are syntactically valid
            const monitorSyntax = await this.execCommand('node -c scripts/system_monitor.cjs 2>&1 || echo "syntax error"');
            const optimizerSyntax = await this.execCommand('node -c scripts/performance_optimizer.cjs 2>&1 || echo "syntax error"');
            
            if (monitorSyntax.includes('syntax error')) {
                return { success: false, error: 'System monitor has syntax errors' };
            }
            
            if (optimizerSyntax.includes('syntax error')) {
                return { success: false, error: 'Performance optimizer has syntax errors' };
            }
            
            return {
                success: true,
                details: {
                    monitorExists: true,
                    optimizerExists: true,
                    syntaxValid: true
                }
            };
        } catch (error) {
            return { success: false, error: `Performance monitoring test failed: ${error.message}` };
        }
    }

    async testFileSystemIntegrity() {
        try {
            const criticalPaths = [
                'src',
                'scripts',
                'state',
                'workflows',
                'vm-integration',
                'docs'
            ];
            
            const missingPaths = [];
            const pathStats = {};
            
            for (const dirPath of criticalPaths) {
                const fullPath = path.join(__dirname, '..', dirPath);
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    pathStats[dirPath] = {
                        exists: true,
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        modified: stats.mtime
                    };
                } else {
                    missingPaths.push(dirPath);
                    pathStats[dirPath] = { exists: false };
                }
            }
            
            if (missingPaths.length > 0) {
                return { success: false, error: `Missing critical directories: ${missingPaths.join(', ')}` };
            }
            
            return {
                success: true,
                details: {
                    allPathsExist: true,
                    checkedPaths: criticalPaths.length,
                    pathStats
                }
            };
        } catch (error) {
            return { success: false, error: `File system integrity test failed: ${error.message}` };
        }
    }

    async testDocumentation() {
        try {
            const docPaths = [
                'docs/main/tmux-claude-implementation.md',
                'docs/main/tmux-mvp-implementation.md',
                'docs/main/tmux-manager-MCP.md',
                'README.md'
            ];
            
            const missingDocs = [];
            const docStats = {};
            
            for (const docPath of docPaths) {
                const fullPath = path.join(__dirname, '..', docPath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    docStats[docPath] = {
                        exists: true,
                        size: content.length,
                        lines: content.split('\n').length
                    };
                } else {
                    missingDocs.push(docPath);
                    docStats[docPath] = { exists: false };
                }
            }
            
            return {
                success: true,
                details: {
                    totalDocs: docPaths.length,
                    existingDocs: docPaths.length - missingDocs.length,
                    missingDocs,
                    docStats
                }
            };
        } catch (error) {
            return { success: false, error: `Documentation test failed: ${error.message}` };
        }
    }

    async testConfiguration() {
        try {
            const configPaths = [
                'package.json',
                '.gitignore',
                'CLAUDE.md'
            ];
            
            const configIssues = [];
            const configStats = {};
            
            for (const configPath of configPaths) {
                const fullPath = path.join(__dirname, '..', configPath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    
                    // Basic validation
                    if (configPath === 'package.json') {
                        try {
                            JSON.parse(content);
                            configStats[configPath] = { valid: true, size: content.length };
                        } catch (e) {
                            configIssues.push(`Invalid JSON in ${configPath}`);
                            configStats[configPath] = { valid: false, error: 'Invalid JSON' };
                        }
                    } else {
                        configStats[configPath] = { valid: true, size: content.length };
                    }
                } else {
                    configIssues.push(`Missing config file: ${configPath}`);
                    configStats[configPath] = { exists: false };
                }
            }
            
            return {
                success: configIssues.length === 0,
                error: configIssues.length > 0 ? configIssues.join(', ') : undefined,
                details: {
                    checkedConfigs: configPaths.length,
                    issues: configIssues,
                    configStats
                }
            };
        } catch (error) {
            return { success: false, error: `Configuration test failed: ${error.message}` };
        }
    }

    // Utility Methods

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command], { timeout: 10000 });
            let output = '';
            let errorOutput = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0 || output.length > 0) {
                    resolve(output);
                } else {
                    reject(new Error(errorOutput || `Command failed with code ${code}`));
                }
            });
            
            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    displaySummary(passed, failed) {
        console.log('📊 Test Results Summary');
        console.log(''.padEnd(60, '='));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
        console.log('');
        
        if (failed > 0) {
            console.log('🔍 Failed Tests:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.name}: ${r.error}`));
            console.log('');
        }
        
        console.log('💡 Recommendations:');
        if (failed === 0) {
            console.log('   🎉 All tests passed! System is healthy.');
        } else if (failed <= 2) {
            console.log('   ⚠️  Address failed tests to improve system reliability.');
        } else {
            console.log('   🚨 Multiple failures detected. System needs attention.');
        }
        
        console.log(''.padEnd(60, '-'));
    }

    async saveResults() {
        try {
            const resultsDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            
            const resultsFile = path.join(resultsDir, 'integration_test_results.json');
            const timestamp = new Date().toISOString();
            
            const report = {
                timestamp,
                summary: {
                    passed: this.results.filter(r => r.success).length,
                    failed: this.results.filter(r => !r.success).length,
                    total: this.results.length
                },
                results: this.results
            };
            
            fs.writeFileSync(resultsFile, JSON.stringify(report, null, 2));
            console.log(`💾 Test results saved to: ${resultsFile}`);
        } catch (error) {
            console.warn(`⚠️  Could not save test results: ${error.message}`);
        }
    }
}

// Command line execution
if (require.main === module) {
    const tester = new IntegrationTester();
    
    tester.runAllTests()
        .then((summary) => {
            process.exit(summary.failed > 0 ? 1 : 0);
        })
        .catch((error) => {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        });
}

module.exports = IntegrationTester;