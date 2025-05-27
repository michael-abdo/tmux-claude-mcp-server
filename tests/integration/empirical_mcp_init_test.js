#!/usr/bin/env node

/**
 * Empirical Test: MCP Tool Availability in Spawned Claude Instances
 * 
 * This test systematically eliminates hypotheses about why MCP tools
 * aren't available in tmux-spawned Claude instances.
 * 
 * Hypotheses to test:
 * 1. Environment variables (CLAUDE_CODE_ENTRYPOINT, CLAUDECODE)
 * 2. Working directory context
 * 3. Configuration file locations
 * 4. Process spawning method
 * 5. Initialization timing
 * 6. Authentication/session state
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { TmuxInterface } from '../src/tmux_interface.js';

class MCPInitTest {
    constructor() {
        this.tmux = new TmuxInterface();
        this.testDir = `mcp_init_test_${Date.now()}`;
        this.results = [];
    }

    async setup() {
        console.log('=== MCP Initialization Empirical Test ===\n');
        
        // Create test directory
        await fs.mkdir(this.testDir, { recursive: true });
        
        // Copy MCP configuration
        const configDir = path.join(this.testDir, '.claude');
        await fs.mkdir(configDir, { recursive: true });
        
        // Create test MCP config
        const testConfig = {
            mcpServers: {
                "tmux-claude": {
                    command: "node",
                    args: [path.resolve('./src/simple_mcp_server.js')],
                    env: {
                        NODE_ENV: "test",
                        PHASE: "3",
                        ALLOWED_TOOLS: JSON.stringify(["spawn", "list", "send", "read", "terminate"])
                    }
                }
            }
        };
        
        await fs.writeFile(
            path.join(configDir, 'settings.json'),
            JSON.stringify(testConfig, null, 2)
        );
        
        // Create test prompt
        const testPrompt = `List all available tools by their exact names. 
If you have MCP tools available, they should appear as functions you can call.
Format your response as:
TOOLS_AVAILABLE: [comma-separated list]
MCP_TOOLS_FOUND: [YES/NO]`;
        
        await fs.writeFile(
            path.join(this.testDir, 'test_prompt.txt'),
            testPrompt
        );
    }

    async runTest(testName, setupCommands, launchCommand, envVars = {}) {
        console.log(`\nTest: ${testName}`);
        console.log('─'.repeat(50));
        
        const sessionName = `mcp_test_${Date.now()}`;
        const result = {
            testName,
            sessionName,
            setupCommands,
            launchCommand,
            envVars,
            success: false,
            mcpToolsFound: false,
            output: '',
            error: null
        };
        
        try {
            // Create tmux session
            await this.tmux.createSession(sessionName, this.testDir);
            const paneTarget = `${sessionName}:0.0`;
            
            // Capture current environment
            const parentEnv = { ...process.env };
            console.log('Parent env vars:', {
                CLAUDE_CODE_ENTRYPOINT: parentEnv.CLAUDE_CODE_ENTRYPOINT,
                CLAUDECODE: parentEnv.CLAUDECODE,
                PATH: parentEnv.PATH?.includes('.claude') ? 'Contains .claude' : 'No .claude'
            });
            
            // Set environment variables
            for (const [key, value] of Object.entries(envVars)) {
                await this.tmux.sendKeys(paneTarget, `export ${key}="${value}"`, true);
                await new Promise(r => setTimeout(r, 100));
            }
            
            // Run setup commands
            for (const cmd of setupCommands) {
                console.log(`  Setup: ${cmd}`);
                await this.tmux.sendKeys(paneTarget, cmd, true);
                await new Promise(r => setTimeout(r, 500));
            }
            
            // Launch Claude
            console.log(`  Launch: ${launchCommand}`);
            await this.tmux.sendKeys(paneTarget, launchCommand, true);
            await new Promise(r => setTimeout(r, 5000)); // Wait for initialization
            
            // Send test prompt
            console.log('  Sending test prompt...');
            await this.tmux.sendKeys(paneTarget, 'cat test_prompt.txt', true);
            await new Promise(r => setTimeout(r, 2000));
            
            // Capture output
            await new Promise(r => setTimeout(r, 3000)); // Wait for response
            const output = await this.tmux.capturePane(paneTarget, 100);
            result.output = output;
            
            // Analyze results
            result.mcpToolsFound = output.includes('spawn') || 
                                  output.includes('tmux-claude:spawn') ||
                                  output.includes('MCP_TOOLS_FOUND: YES');
            
            result.success = true;
            console.log(`  MCP Tools Found: ${result.mcpToolsFound ? 'YES ✓' : 'NO ✗'}`);
            
            // Kill session
            await this.tmux.killSession(sessionName);
            
        } catch (error) {
            result.error = error.message;
            console.error(`  Error: ${error.message}`);
            try {
                await this.tmux.killSession(sessionName);
            } catch {}
        }
        
        this.results.push(result);
        return result;
    }

    async runAllTests() {
        await this.setup();
        
        // Test 1: Baseline - Just launch Claude
        await this.runTest(
            'Baseline - No special setup',
            [],
            'claude --dangerously-skip-permissions'
        );
        
        // Test 2: With environment variables
        await this.runTest(
            'With Claude env vars',
            [],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 3: With full PATH
        await this.runTest(
            'With full PATH including .claude',
            [],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1',
                PATH: process.env.PATH
            }
        );
        
        // Test 4: Using absolute path to claude
        await this.runTest(
            'Using absolute claude path',
            [],
            '/Users/Mike/.claude/local/node_modules/.bin/claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 5: With NODE_OPTIONS
        await this.runTest(
            'With NODE_OPTIONS from parent',
            [],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1',
                NODE_OPTIONS: process.env.NODE_OPTIONS || ''
            }
        );
        
        // Test 6: Launch via node directly
        await this.runTest(
            'Direct node execution',
            [],
            'node --no-warnings --enable-source-maps /Users/Mike/.claude/local/node_modules/.bin/claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 7: With explicit MCP config path
        await this.runTest(
            'With explicit config path',
            [`export CLAUDE_MCP_CONFIG_PATH="${path.join(this.testDir, '.claude', 'settings.json')}"`],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 8: Copy global settings
        await this.runTest(
            'With copied global settings',
            [
                'cp ~/.claude/settings.json .claude/',
                'cat .claude/settings.json'
            ],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 9: Interactive mode test
        await this.runTest(
            'Interactive mode with -i flag',
            [],
            'claude -i --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1'
            }
        );
        
        // Test 10: With home directory
        await this.runTest(
            'With HOME set',
            [],
            'claude --dangerously-skip-permissions',
            {
                CLAUDE_CODE_ENTRYPOINT: 'cli',
                CLAUDECODE: '1',
                HOME: process.env.HOME
            }
        );
        
        await this.generateReport();
    }

    async generateReport() {
        console.log('\n\n=== EMPIRICAL TEST RESULTS ===\n');
        
        // Summary table
        console.log('Test Summary:');
        console.log('─'.repeat(70));
        console.log('Test Name'.padEnd(40) + 'MCP Tools Found');
        console.log('─'.repeat(70));
        
        for (const result of this.results) {
            const status = result.mcpToolsFound ? '✓ YES' : '✗ NO';
            console.log(result.testName.padEnd(40) + status);
        }
        
        // Detailed analysis
        console.log('\n\nDetailed Analysis:');
        console.log('─'.repeat(70));
        
        const successfulTests = this.results.filter(r => r.mcpToolsFound);
        if (successfulTests.length > 0) {
            console.log('\n✓ SUCCESSFUL CONFIGURATIONS:');
            for (const test of successfulTests) {
                console.log(`\nTest: ${test.testName}`);
                console.log(`Command: ${test.launchCommand}`);
                console.log(`Env vars: ${JSON.stringify(test.envVars, null, 2)}`);
            }
        } else {
            console.log('\n✗ NO SUCCESSFUL CONFIGURATIONS FOUND');
        }
        
        // Save detailed results
        const reportPath = path.join(this.testDir, 'mcp_init_test_results.json');
        await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\nDetailed results saved to: ${reportPath}`);
        
        // Hypothesis conclusions
        console.log('\n\nHYPOTHESIS CONCLUSIONS:');
        console.log('─'.repeat(70));
        
        // Check if env vars made a difference
        const baselineResult = this.results.find(r => r.testName.includes('Baseline'));
        const envVarResult = this.results.find(r => r.testName.includes('With Claude env vars'));
        
        if (baselineResult && envVarResult) {
            if (!baselineResult.mcpToolsFound && envVarResult.mcpToolsFound) {
                console.log('✓ Environment variables ARE required for MCP tools');
            } else if (!baselineResult.mcpToolsFound && !envVarResult.mcpToolsFound) {
                console.log('✗ Environment variables alone are NOT sufficient');
            }
        }
        
        // Additional analysis
        if (successfulTests.length === 0) {
            console.log('\n⚠️  CRITICAL FINDING: MCP tools are not available through ANY tested method');
            console.log('This suggests a fundamental architectural constraint where MCP tools');
            console.log('are only available to the primary Claude instance, not spawned instances.');
            console.log('\nThe bridge workaround remains the only viable solution.');
        }
    }
}

// Run the test
const test = new MCPInitTest();
test.runAllTests().catch(console.error);