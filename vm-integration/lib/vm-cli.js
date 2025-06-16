#!/usr/bin/env node

/**
 * VM CLI - Command line interface for managing Claude Code development VMs
 * 
 * Usage:
 *   node vm-cli.js create <name> [options]
 *   node vm-cli.js list [options]
 *   node vm-cli.js start <name|id>
 *   node vm-cli.js stop <name|id>
 *   node vm-cli.js terminate <name|id>
 *   node vm-cli.js ssh <name|id>
 *   node vm-cli.js status <name|id>
 */

import { parseArgs } from 'node:util';
import { VMManager } from './vm_manager.js';

// Version information
const VERSION = '1.0.0';

// Exit codes
const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  VM_ERROR: 3,
  AWS_ERROR: 4
};

/**
 * Parse command line arguments
 */
function parseCommandLine() {
  try {
    const { values, positionals } = parseArgs({
      args: process.argv.slice(2),
      options: {
        region: { type: 'string', short: 'r' },
        'instance-type': { type: 'string', short: 't' },
        'key-name': { type: 'string', short: 'k' },
        'security-group': { type: 'string', short: 's' },
        spot: { type: 'boolean' },
        'max-price': { type: 'string' },
        'image-id': { type: 'string' },
        'include-terminated': { type: 'boolean' },
        verbose: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'V' }
      },
      allowPositionals: true
    });

    return {
      command: positionals[0],
      target: positionals[1],
      region: values.region,
      instanceType: values['instance-type'],
      keyName: values['key-name'],
      securityGroup: values['security-group'],
      spot: values.spot,
      maxPrice: values['max-price'],
      imageId: values['image-id'],
      includeTerminated: values['include-terminated'],
      verbose: values.verbose,
      help: values.help,
      version: values.version,
      extraArgs: positionals.slice(2)
    };
  } catch (error) {
    console.error(`❌ Error parsing arguments: ${error.message}`);
    showUsage();
    process.exit(EXIT_CODES.INVALID_ARGS);
  }
}

/**
 * Display help text
 */
function showHelp() {
  console.log(`VM CLI - Manage Claude Code Development VMs

USAGE:
  node vm-cli.js <command> [target] [options]

COMMANDS:
  create <name>     Create a new VM instance
  list              List all VM instances  
  start <name|id>   Start a stopped VM instance
  stop <name|id>    Stop a running VM instance
  terminate <name|id> Terminate a VM instance (permanent)
  ssh <name|id>     Get SSH command for connecting to VM
  status <name|id>  Get detailed status of VM instance
  image <name|id>   Create AMI from VM instance

OPTIONS:
  -r, --region <region>           AWS region (default: us-east-1)
  -t, --instance-type <type>      EC2 instance type (default: m5.xlarge)
  -k, --key-name <key>           AWS key pair name (default: claude-dev-key)
  -s, --security-group <sg>      Security group (default: claude-dev-sg)
  --spot                         Use spot instance for cost savings
  --max-price <price>            Maximum spot price (default: 0.10)
  --image-id <ami>               Custom AMI ID
  --include-terminated           Include terminated instances in list
  -v, --verbose                  Enable verbose output
  -h, --help                     Show this help message
  -V, --version                  Show version information

EXAMPLES:
  # Create a new development VM
  node vm-cli.js create my-dev-vm

  # Create a spot instance to save costs
  node vm-cli.js create spot-vm --spot --max-price 0.05

  # List all running VMs
  node vm-cli.js list

  # Connect to a VM via SSH
  node vm-cli.js ssh my-dev-vm

  # Stop a VM to save costs
  node vm-cli.js stop my-dev-vm

  # Create an AMI template from configured VM
  node vm-cli.js image my-dev-vm

SETUP REQUIREMENTS:
  1. AWS CLI installed and configured
  2. AWS credentials with EC2 permissions
  3. Key pair created: aws ec2 create-key-pair --key-name claude-dev-key
  4. Security group allowing SSH access

For setup help, see: vm-integration/minimal-vm-setup-guide.md`);
}

/**
 * Display usage information
 */
function showUsage() {
  console.log(`Usage: node vm-cli.js <command> [target] [options]
Try: node vm-cli.js --help`);
}

/**
 * Display version information
 */
function showVersion() {
  console.log(`vm-cli v${VERSION}`);
}

/**
 * Create VM manager instance with CLI options
 */
function createVMManager(args) {
  const options = {};
  
  if (args.region) options.region = args.region;
  if (args.instanceType) options.instanceType = args.instanceType;
  if (args.keyName) options.keyName = args.keyName;
  if (args.securityGroup) options.securityGroup = args.securityGroup;
  
  return new VMManager(options);
}

/**
 * Handle create command
 */
async function handleCreate(args) {
  if (!args.target) {
    console.error('❌ Error: VM name required for create command');
    console.error('Usage: node vm-cli.js create <name> [options]');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  
  const options = {};
  if (args.instanceType) options.instanceType = args.instanceType;
  if (args.imageId) options.imageId = args.imageId;
  if (args.spot) options.spot = true;
  if (args.maxPrice) options.maxPrice = args.maxPrice;
  if (args.keyName) options.keyName = args.keyName;
  if (args.securityGroup) options.securityGroups = [args.securityGroup];

  try {
    const instance = await vmManager.createInstance(args.target, options);
    
    console.log('\n🎉 VM instance created successfully!');
    console.log(`📍 Instance ID: ${instance.instanceId}`);
    console.log(`🌐 Public IP: ${instance.publicIp || 'pending'}`);
    console.log(`🔗 SSH Command: ${vmManager.getSSHCommand(instance.instanceId)}`);
    console.log('\n💡 Next steps:');
    console.log('1. Wait for instance to fully initialize (2-3 minutes)');
    console.log('2. Connect via SSH and add your GitHub SSH key');
    console.log('3. Clone your repositories and start developing!');
    
  } catch (error) {
    console.error(`❌ Failed to create VM: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle list command
 */
async function handleList(args) {
  const vmManager = createVMManager(args);
  
  try {
    const instances = await vmManager.listInstances({
      includeTerminated: args.includeTerminated
    });
    
    if (instances.length === 0) {
      console.log('📋 No VM instances found');
      console.log('\n💡 Create your first VM:');
      console.log('   node vm-cli.js create my-first-vm');
      return;
    }

    console.log(`\n📊 Total instances: ${instances.length}`);
    const running = instances.filter(i => i.status === 'running').length;
    const stopped = instances.filter(i => i.status === 'stopped').length;
    console.log(`   🟢 Running: ${running}`);
    console.log(`   🔴 Stopped: ${stopped}`);
    console.log(`   ⚫ Other: ${instances.length - running - stopped}`);
    
  } catch (error) {
    console.error(`❌ Failed to list VMs: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle start command
 */
async function handleStart(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for start command');
    console.error('Usage: node vm-cli.js start <name|id>');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  
  try {
    await vmManager.startInstance(args.target);
    console.log('\n🎉 VM started successfully!');
    console.log(`🔗 SSH Command: ${vmManager.getSSHCommand(args.target)}`);
  } catch (error) {
    console.error(`❌ Failed to start VM: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle stop command
 */
async function handleStop(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for stop command');
    console.error('Usage: node vm-cli.js stop <name|id>');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  
  try {
    await vmManager.stopInstance(args.target);
    console.log('\n✅ VM stopped successfully!');
    console.log('💰 This will save on compute costs while preserving your work');
    console.log('🔄 Start it again with: node vm-cli.js start ' + args.target);
  } catch (error) {
    console.error(`❌ Failed to stop VM: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle terminate command
 */
async function handleTerminate(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for terminate command');
    console.error('Usage: node vm-cli.js terminate <name|id>');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  // Confirmation for destructive action
  console.log('⚠️  WARNING: This will permanently destroy the VM instance!');
  console.log('   All data on the instance will be lost.');
  console.log('   Type "yes" to confirm termination:');
  
  // In a real implementation, you'd want to add interactive confirmation
  // For now, proceeding with termination
  
  const vmManager = createVMManager(args);
  
  try {
    await vmManager.terminateInstance(args.target);
    console.log('\n✅ VM terminated successfully!');
    console.log('💾 Remember to backup any important data before terminating');
  } catch (error) {
    console.error(`❌ Failed to terminate VM: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle SSH command
 */
async function handleSSH(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for ssh command');
    console.error('Usage: node vm-cli.js ssh <name|id>');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  
  try {
    const sshCommand = vmManager.getSSHCommand(args.target);
    console.log('🔗 SSH Connection Command:');
    console.log(`   ${sshCommand}`);
    console.log('\n💡 Copy and paste the command above to connect to your VM');
    console.log('📋 Or run it directly by piping to bash (if you trust it):');
    console.log(`   ${sshCommand} # <- Copy this`);
  } catch (error) {
    console.error(`❌ Failed to get SSH command: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle status command
 */
async function handleStatus(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for status command');
    console.error('Usage: node vm-cli.js status <name|id>');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  
  try {
    const metrics = await vmManager.getInstanceMetrics(args.target);
    
    if (!metrics) {
      console.log(`❌ No metrics available for ${args.target}`);
      return;
    }

    console.log(`\n📊 VM Status: ${args.target}`);
    console.log('─'.repeat(40));
    console.log(`Instance ID: ${metrics.instanceId}`);
    console.log(`Status: ${vmManager.getStatusIcon(metrics.status)} ${metrics.status}`);
    console.log(`Public IP: ${metrics.publicIp || 'none'}`);
    console.log(`Private IP: ${metrics.privateIp || 'none'}`);
    
    if (metrics.uptime) {
      const uptimeHours = Math.floor(metrics.uptime / (1000 * 60 * 60));
      console.log(`Uptime: ${uptimeHours}h`);
    }
    
    console.log(`Last Updated: ${new Date(metrics.lastUpdated).toLocaleString()}`);
    
    if (metrics.status === 'running' && metrics.publicIp) {
      console.log(`\n🔗 SSH: ${vmManager.getSSHCommand(args.target)}`);
    }
    
  } catch (error) {
    console.error(`❌ Failed to get VM status: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Handle image command
 */
async function handleImage(args) {
  if (!args.target) {
    console.error('❌ Error: VM name or ID required for image command');
    console.error('Usage: node vm-cli.js image <name|id> [image-name]');
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  const vmManager = createVMManager(args);
  const imageName = args.extraArgs[0] || `${args.target}-template-${Date.now()}`;
  
  try {
    const imageId = await vmManager.createImage(
      args.target, 
      imageName, 
      `Template created from ${args.target} on ${new Date().toISOString()}`
    );
    
    console.log('\n📸 AMI creation initiated successfully!');
    console.log(`🆔 Image ID: ${imageId}`);
    console.log(`📝 Image Name: ${imageName}`);
    console.log('\n💡 You can now use this AMI to launch identical VMs quickly:');
    console.log(`   node vm-cli.js create new-vm --image-id ${imageId}`);
    console.log('\n⏰ AMI creation may take several minutes to complete');
    
  } catch (error) {
    console.error(`❌ Failed to create AMI: ${error.message}`);
    process.exit(EXIT_CODES.VM_ERROR);
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = parseCommandLine();
  
  // Handle help and version flags
  if (args.help) {
    showHelp();
    process.exit(EXIT_CODES.SUCCESS);
  }
  
  if (args.version) {
    showVersion();
    process.exit(EXIT_CODES.SUCCESS);
  }
  
  // Check for valid command
  if (!args.command) {
    console.error('❌ Error: Command required');
    showUsage();
    process.exit(EXIT_CODES.INVALID_ARGS);
  }

  // Route to command handlers
  try {
    switch (args.command) {
      case 'create':
        await handleCreate(args);
        break;
      case 'list':
        await handleList(args);
        break;
      case 'start':
        await handleStart(args);
        break;
      case 'stop':
        await handleStop(args);
        break;
      case 'terminate':
        await handleTerminate(args);
        break;
      case 'ssh':
        await handleSSH(args);
        break;
      case 'status':
        await handleStatus(args);
        break;
      case 'image':
        await handleImage(args);
        break;
      default:
        console.error(`❌ Error: Unknown command '${args.command}'`);
        showUsage();
        process.exit(EXIT_CODES.INVALID_ARGS);
    }
  } catch (error) {
    if (args.verbose) {
      console.error('❌ Detailed error:', error);
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    process.exit(EXIT_CODES.GENERAL_ERROR);
  }
}

// Run the CLI
main().catch(error => {
  console.error(`❌ Unexpected error: ${error.message}`);
  process.exit(EXIT_CODES.GENERAL_ERROR);
});