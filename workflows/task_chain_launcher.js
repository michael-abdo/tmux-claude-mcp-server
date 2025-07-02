#!/usr/bin/env node
/**
 * Task Chain Launcher - Runs a task through multiple stages
 * 
 * This launcher reads a task progression config and:
 * 1. Replaces {{TASK}} placeholders with the actual task description
 * 2. Sends the initial prompt to start the chain
 * 3. Runs the chain monitor to handle stage progression
 * 
 * Usage: node task_chain_launcher.js <configFile> [instanceId]
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { ChainKeywordMonitor } from './chain_keyword_monitor.js';
import { createMCPBridge, replaceTemplatePlaceholders, getLatestInstanceId as getLatestInstance } from './shared/workflow_utils.js';

async function loadTaskConfig(configPath) {
  try {
    const configData = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    if (!config.taskDescription) {
      throw new Error('Config must include taskDescription field');
    }
    if (!config.initialPrompt) {
      throw new Error('Config must include initialPrompt field');
    }
    
    return config;
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Config file not found: ${configPath}`);
    }
    throw error;
  }
}



async function main() {
  const configPath = process.argv[2];
  let instanceId = process.argv[3];
  
  if (!configPath) {
    console.error('Usage: node task_chain_launcher.js <configFile> [instanceId]');
    console.error('\nExample: node task_chain_launcher.js task_progression_config.json');
    console.error('\nIf instanceId is not provided, will use the latest active instance');
    process.exit(1);
  }
  
  try {
    console.log('🚀 TASK CHAIN LAUNCHER');
    console.log('=====================\n');
    
    // Load config
    console.log(`📖 Loading config from: ${configPath}`);
    const config = await loadTaskConfig(configPath);
    
    // Get instance ID if not provided
    const bridge = createMCPBridge();
    if (!instanceId) {
      console.log('🔍 Finding latest instance...');
      instanceId = config.instanceId === 'YOUR_INSTANCE_ID' 
        ? await getLatestInstance(bridge)
        : config.instanceId;
    }
    
    console.log(`📋 Instance ID: ${instanceId}`);
    console.log(`📝 Task: "${config.taskDescription}"`);
    
    // Replace {{TASK}} in all instructions
    const processedConfig = {
      ...config,
      instanceId,
      chains: config.chains.map(chain => ({
        ...chain,
        instruction: replaceTemplatePlaceholders(chain.instruction, { TASK: config.taskDescription })
      }))
    };
    
    // Prepare initial prompt
    const initialPrompt = replaceTemplatePlaceholders(config.initialPrompt, { TASK: config.taskDescription });
    
    console.log('\n📨 Sending initial prompt to start the chain...');
    console.log('━'.repeat(60));
    console.log(initialPrompt);
    console.log('━'.repeat(60));
    
    // Send initial prompt
    const sendResult = await bridge.send({
      instanceId,
      text: initialPrompt
    });
    
    if (!sendResult.success) {
      throw new Error(`Failed to send initial prompt: ${sendResult.error}`);
    }
    
    console.log('✅ Initial prompt sent successfully');
    console.log('\n🔗 Starting chain monitor...\n');
    
    // Create and start the monitor
    const monitor = new ChainKeywordMonitor(processedConfig);
    
    // Event handlers
    monitor.on('started', () => {
      console.log('🎯 Chain monitor active and watching for keywords');
    });
    
    monitor.on('chain_executed', ({ keyword, chainIndex }) => {
      console.log(`\n🔗 Stage ${chainIndex + 1} triggered by: ${keyword}`);
    });
    
    monitor.on('chain_complete', ({ totalStages }) => {
      console.log('\n🏆 TASK CHAIN COMPLETED!');
      console.log(`✅ All ${totalStages} stages executed successfully`);
      console.log(`📋 Task: "${config.taskDescription}"`);
      process.exit(0);
    });
    
    monitor.on('chain_failed', ({ keyword, instruction }) => {
      console.error('\n💥 CHAIN FAILED');
      console.error(`Failed at keyword: ${keyword}`);
      process.exit(1);
    });
    
    monitor.on('timeout', ({ currentChain, executedChains }) => {
      console.log('\n⏰ TIMEOUT: Chain execution exceeded time limit');
      console.log(`Completed ${executedChains} out of ${processedConfig.chains.length + 1} stages`);
      process.exit(1);
    });
    
    monitor.on('error', (error) => {
      console.error('\n💥 MONITOR ERROR:', error);
      process.exit(1);
    });
    
    // Start monitoring
    monitor.start();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down task chain launcher...');
      monitor.stop();
      setTimeout(() => process.exit(0), 1000);
    });
    
  } catch (error) {
    console.error('💥 Failed to start task chain:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Task chain launcher crashed:', error);
    process.exit(1);
  });
}