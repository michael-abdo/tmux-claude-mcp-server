/**
 * Reliable tmux→Claude Message Sender (JavaScript implementation)
 * Based on empirical testing results from Python tests
 */

import { spawn } from 'child_process';

class ReliableTmuxSender {
    constructor(sessionName, defaultStrategy = 'doubleEnterWithVerification') {
        this.sessionName = sessionName;
        this.defaultStrategy = defaultStrategy;
    }

    /**
     * Send message to tmux session with high reliability
     * @param {string} message - Message to send
     * @param {string} strategy - Strategy to use
     * @param {number} maxRetries - Maximum retry attempts
     * @returns {Promise<boolean>} Success status
     */
    async sendMessage(message, strategy = null, maxRetries = 3) {
        strategy = strategy || this.defaultStrategy;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const success = await this._executeStrategy(message, strategy);
                if (success) {
                    console.log(`✅ Message sent successfully on attempt ${attempt + 1}`);
                    return true;
                } else {
                    console.warn(`⚠️ Message send failed on attempt ${attempt + 1}`);
                    await this._sleep(500 * (attempt + 1)); // Exponential backoff
                }
            } catch (error) {
                console.error(`❌ Error on attempt ${attempt + 1}:`, error.message);
                await this._sleep(500 * (attempt + 1));
            }
        }
        
        console.error(`❌ Failed to send message after ${maxRetries} attempts`);
        return false;
    }

    /**
     * Execute specific sending strategy
     */
    async _executeStrategy(message, strategy) {
        switch (strategy) {
            case 'singleEnter':
                return await this._singleEnter(message);
            case 'doubleEnter':
                return await this._doubleEnter(message);
            case 'doubleEnterWithVerification':
                return await this._doubleEnterWithVerification(message);
            case 'enterDelayEnter':
                return await this._enterDelayEnter(message);
            case 'separateCommands':
                return await this._separateCommands(message);
            case 'bulletproof':
                return await this._bulletproofStrategy(message);
            default:
                throw new Error(`Unknown strategy: ${strategy}`);
        }
    }

    /**
     * Standard single Enter - fastest but potentially unreliable
     */
    async _singleEnter(message) {
        const args = ['send-keys', '-t', this.sessionName, message, 'Enter'];
        return await this._runTmuxCommand(args);
    }

    /**
     * Double Enter for extra reliability
     */
    async _doubleEnter(message) {
        const args = ['send-keys', '-t', this.sessionName, message, 'Enter', 'Enter'];
        return await this._runTmuxCommand(args);
    }

    /**
     * Double Enter with verification - recommended default
     */
    async _doubleEnterWithVerification(message) {
        // Send with double enter
        const args = ['send-keys', '-t', this.sessionName, message, 'Enter', 'Enter'];
        const sendSuccess = await this._runTmuxCommand(args);
        
        if (!sendSuccess) {
            return false;
        }

        // Wait briefly and verify message appeared in tmux
        await this._sleep(500);
        const verifyArgs = ['capture-pane', '-t', this.sessionName, '-p'];
        const output = await this._runTmuxCommand(verifyArgs, true);
        
        // Check if our message appears in the tmux output
        return output && output.includes(message.substring(0, 30));
    }

    /**
     * Enter, delay, Enter strategy for problematic sessions
     */
    async _enterDelayEnter(message) {
        // First enter
        const args1 = ['send-keys', '-t', this.sessionName, message, 'Enter'];
        const success1 = await this._runTmuxCommand(args1);
        
        if (!success1) {
            return false;
        }

        // Delay
        await this._sleep(500);

        // Second enter
        const args2 = ['send-keys', '-t', this.sessionName, 'Enter'];
        return await this._runTmuxCommand(args2);
    }

    /**
     * Separate message and Enter commands
     */
    async _separateCommands(message) {
        // Send message without enter
        const args1 = ['send-keys', '-t', this.sessionName, message];
        const success1 = await this._runTmuxCommand(args1);
        
        if (!success1) {
            return false;
        }

        // Brief pause
        await this._sleep(100);

        // Send enter
        const args2 = ['send-keys', '-t', this.sessionName, 'Enter'];
        return await this._runTmuxCommand(args2);
    }

    /**
     * Maximum reliability strategy - use for critical messages
     */
    async _bulletproofStrategy(message) {
        try {
            // Strategy 1: Separate commands
            if (await this._separateCommands(message)) {
                return true;
            }

            await this._sleep(300);

            // Strategy 2: Double enter with delay
            if (await this._enterDelayEnter(message)) {
                return true;
            }

            await this._sleep(500);

            // Strategy 3: Triple enter as last resort
            const args = ['send-keys', '-t', this.sessionName, message, 'Enter', 'Enter', 'Enter'];
            return await this._runTmuxCommand(args);

        } catch (error) {
            return false;
        }
    }

    /**
     * Quick test to verify session is responsive
     */
    async quickTest() {
        const testMsg = `QUICK_TEST_${Date.now()}: Ping`;
        return await this.sendMessage(testMsg, 'doubleEnterWithVerification', 1);
    }

    /**
     * Run tmux command and return success/output
     */
    async _runTmuxCommand(args, returnOutput = false) {
        return new Promise((resolve) => {
            const child = spawn('tmux', args, { timeout: 5000 });
            let output = '';
            let errorOutput = '';

            child.stdout.on('data', (data) => {
                output += data.toString();
            });

            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            child.on('close', (code) => {
                if (returnOutput) {
                    resolve(code === 0 ? output : null);
                } else {
                    resolve(code === 0);
                }
            });

            child.on('error', (error) => {
                console.error(`tmux command error:`, error);
                resolve(returnOutput ? null : false);
            });
        });
    }

    /**
     * Sleep utility
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Convenience functions for direct use
 */
async function sendToClaude(sessionName, message, strategy = 'doubleEnterWithVerification') {
    const sender = new ReliableTmuxSender(sessionName, strategy);
    return await sender.sendMessage(message);
}

async function sendToClaudeBulletproof(sessionName, message) {
    return await sendToClaude(sessionName, message, 'bulletproof');
}

/**
 * Enhanced tmux interface that uses reliable sending
 */
class EnhancedTmuxInterface {
    constructor() {
        this.senders = new Map(); // Cache senders by session
    }

    /**
     * Get or create reliable sender for session
     */
    getSender(sessionName) {
        if (!this.senders.has(sessionName)) {
            this.senders.set(sessionName, new ReliableTmuxSender(sessionName));
        }
        return this.senders.get(sessionName);
    }

    /**
     * Send message with automatic strategy selection based on message type
     */
    async sendMessage(sessionName, message, priority = 'normal') {
        const sender = this.getSender(sessionName);
        
        let strategy;
        switch (priority) {
            case 'low':
                strategy = 'singleEnter';
                break;
            case 'normal':
                strategy = 'doubleEnterWithVerification';
                break;
            case 'high':
                strategy = 'bulletproof';
                break;
            case 'critical':
                strategy = 'bulletproof';
                break;
            default:
                strategy = 'doubleEnterWithVerification';
        }

        return await sender.sendMessage(message, strategy);
    }

    /**
     * Send workflow instructions (high priority)
     */
    async sendWorkflowInstructions(sessionName, instructions) {
        return await this.sendMessage(sessionName, instructions, 'high');
    }

    /**
     * Send quick command (normal priority)
     */
    async sendCommand(sessionName, command) {
        return await this.sendMessage(sessionName, command, 'normal');
    }

    /**
     * Send critical system message (maximum reliability)
     */
    async sendCriticalMessage(sessionName, message) {
        return await this.sendMessage(sessionName, message, 'critical');
    }

    /**
     * Test session responsiveness
     */
    async testSession(sessionName) {
        const sender = this.getSender(sessionName);
        return await sender.quickTest();
    }
}

// Export for use in other modules
export {
    ReliableTmuxSender,
    EnhancedTmuxInterface,
    sendToClaude,
    sendToClaudeBulletproof
};

// Command-line usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node reliable_tmux_sender.js <session_name> <message> [strategy]');
        console.log('\nAvailable strategies:');
        console.log('  - singleEnter (fastest)');
        console.log('  - doubleEnter');
        console.log('  - doubleEnterWithVerification (recommended default)');
        console.log('  - enterDelayEnter');
        console.log('  - separateCommands');
        console.log('  - bulletproof (maximum reliability)');
        process.exit(1);
    }

    const [sessionName, message, strategy = 'doubleEnterWithVerification'] = args;

    console.log(`🎯 Sending to session: ${sessionName}`);
    console.log(`📝 Message: ${message}`);
    console.log(`⚙️  Strategy: ${strategy}`);

    (async () => {
        const sender = new ReliableTmuxSender(sessionName, strategy);
        
        // Quick test first
        console.log('🔍 Testing session responsiveness...');
        if (!(await sender.quickTest())) {
            console.log('❌ Session appears unresponsive!');
            process.exit(1);
        }

        console.log('✅ Session responsive, sending message...');
        const success = await sender.sendMessage(message);

        if (success) {
            console.log('✅ Message sent successfully!');
            process.exit(0);
        } else {
            console.log('❌ Failed to send message!');
            process.exit(1);
        }
    })();
}