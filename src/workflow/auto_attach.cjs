/**
 * Auto-Attach Mechanism for tmux Sessions
 * Automatically opens terminal and attaches to Claude instance session
 */

const { spawn } = require('child_process');
const os = require('os');

class AutoAttach {
  constructor(options = {}) {
    this.options = options;
    this.debug = options.debug || false;
  }

  /**
   * Automatically attach to a tmux session based on platform
   * @param {string} instanceId - The Claude instance ID
   * @returns {Promise<boolean>} - Success status
   */
  async attachToSession(instanceId) {
    const sessionName = `claude_${instanceId}`;
    
    if (this.debug) {
      console.log(`🔗 Auto-attaching to session: ${sessionName}`);
    }

    try {
      // First verify the session exists
      const sessionExists = await this.verifySessionExists(sessionName);
      if (!sessionExists) {
        console.error(`❌ Session ${sessionName} does not exist`);
        return false;
      }

      // Platform-specific attachment
      const platform = os.platform();
      
      switch (platform) {
        case 'darwin': // macOS
          return await this.attachMacOS(sessionName);
        
        case 'linux':
          return await this.attachLinux(sessionName);
        
        default:
          return await this.attachGeneric(sessionName);
      }
      
    } catch (error) {
      console.error(`❌ Auto-attach failed:`, error.message);
      return false;
    }
  }

  /**
   * Verify that a tmux session exists
   * @param {string} sessionName - Session name to check
   * @returns {Promise<boolean>} - Whether session exists
   */
  async verifySessionExists(sessionName) {
    return new Promise((resolve) => {
      const process = spawn('tmux', ['has-session', '-t', sessionName], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        resolve(code === 0);
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Auto-attach on macOS using Terminal.app
   * @param {string} sessionName - tmux session name
   * @returns {Promise<boolean>} - Success status
   */
  async attachMacOS(sessionName) {
    const attachCommand = `tmux attach-session -t ${sessionName}`;
    
    // Use AppleScript to open a new Terminal window
    const appleScript = `
      tell application "Terminal"
        do script "${attachCommand}"
        activate
      end tell
    `;

    return new Promise((resolve) => {
      const process = spawn('osascript', ['-e', appleScript], {
        stdio: 'pipe'
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Opened new Terminal window attached to ${sessionName}`);
          resolve(true);
        } else {
          console.error(`❌ Failed to open Terminal window (exit code: ${code})`);
          this.showManualInstructions(sessionName);
          resolve(false);
        }
      });

      process.on('error', (error) => {
        console.error(`❌ AppleScript failed:`, error.message);
        this.showManualInstructions(sessionName);
        resolve(false);
      });
    });
  }

  /**
   * Auto-attach on Linux (try multiple terminal emulators)
   * @param {string} sessionName - tmux session name
   * @returns {Promise<boolean>} - Success status
   */
  async attachLinux(sessionName) {
    const attachCommand = `tmux attach-session -t ${sessionName}`;
    
    // Try common Linux terminal emulators in order of preference
    const terminals = [
      'gnome-terminal',
      'xfce4-terminal', 
      'konsole',
      'xterm',
      'urxvt',
      'alacritty',
      'kitty'
    ];

    for (const terminal of terminals) {
      if (await this.tryTerminal(terminal, attachCommand)) {
        console.log(`✅ Opened ${terminal} attached to ${sessionName}`);
        return true;
      }
    }

    console.error(`❌ No supported terminal emulator found`);
    this.showManualInstructions(sessionName);
    return false;
  }

  /**
   * Try to open a specific terminal emulator
   * @param {string} terminal - Terminal command name
   * @param {string} command - Command to run in terminal
   * @returns {Promise<boolean>} - Success status
   */
  async tryTerminal(terminal, command) {
    return new Promise((resolve) => {
      // Check if terminal is available
      const checkProcess = spawn('which', [terminal], { stdio: 'pipe' });
      
      checkProcess.on('close', (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }

        // Terminal is available, try to launch it
        let args = [];
        
        // Configure arguments based on terminal type
        switch (terminal) {
          case 'gnome-terminal':
            args = ['--', 'bash', '-c', `${command}; exec bash`];
            break;
          case 'xfce4-terminal':
            args = ['-e', `bash -c "${command}; exec bash"`];
            break;
          case 'konsole':
            args = ['-e', 'bash', '-c', `${command}; exec bash`];
            break;
          case 'xterm':
          case 'urxvt':
            args = ['-e', 'bash', '-c', `${command}; exec bash`];
            break;
          case 'alacritty':
          case 'kitty':
            args = ['-e', 'bash', '-c', `${command}; exec bash`];
            break;
          default:
            args = ['-e', command];
        }

        const launchProcess = spawn(terminal, args, {
          stdio: 'ignore',
          detached: true
        });

        launchProcess.unref();

        // Give it a moment to launch
        setTimeout(() => {
          resolve(true);
        }, 1000);

        launchProcess.on('error', () => {
          resolve(false);
        });
      });
    });
  }

  /**
   * Generic attachment (fallback)
   * @param {string} sessionName - tmux session name
   * @returns {Promise<boolean>} - Success status
   */
  async attachGeneric(sessionName) {
    console.log(`ℹ️  Platform not specifically supported for auto-attach`);
    this.showManualInstructions(sessionName);
    return false;
  }

  /**
   * Show manual attachment instructions
   * @param {string} sessionName - tmux session name
   */
  showManualInstructions(sessionName) {
    console.log('');
    console.log('🔗 Manual Attachment Instructions:');
    console.log('================================');
    console.log(`tmux attach-session -t ${sessionName}`);
    console.log('');
    console.log('Or list all sessions with:');
    console.log('tmux list-sessions');
    console.log('');
  }

  /**
   * Wait for session to be ready for attachment
   * @param {string} instanceId - Instance ID to monitor
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<boolean>} - Whether session became ready
   */
  async waitForSessionReady(instanceId, timeout = 30000) {
    const sessionName = `claude_${instanceId}`;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await this.verifySessionExists(sessionName)) {
        // Also check if session has activity (not just created)
        const hasActivity = await this.checkSessionActivity(sessionName);
        if (hasActivity) {
          return true;
        }
      }
      
      // Wait 1 second before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return false;
  }

  /**
   * Check if tmux session has activity (indicates Claude is ready)
   * @param {string} sessionName - Session name
   * @returns {Promise<boolean>} - Whether session has activity
   */
  async checkSessionActivity(sessionName) {
    return new Promise((resolve) => {
      const process = spawn('tmux', ['capture-pane', '-t', sessionName, '-p'], {
        stdio: 'pipe'
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Check if there's meaningful content (not just empty session)
          const hasContent = output.trim().length > 0 && 
                           !output.includes('No such session') &&
                           output.includes('Claude'); // Look for Claude prompt
          resolve(hasContent);
        } else {
          resolve(false);
        }
      });

      process.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = AutoAttach;