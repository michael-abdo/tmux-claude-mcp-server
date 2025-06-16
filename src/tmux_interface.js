/**
 * Tmux Interface - Harvested from tmux-manager/src/integration/tmux_interface.py
 * 
 * Core tmux operations for the MCP server. This is a direct harvest of the 
 * essential tmux control functionality, adapted for Node.js and MCP architecture.
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TmuxInterface {
    constructor() {
        this.server = null; // Will use tmux command-line interface
    }

    /**
     * List all tmux sessions with their details.
     * Harvested from: tmux_interface.py lines 37-63
     */
    async listSessions() {
        try {
            const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}:#{session_windows}:#{session_attached}"');
            const sessions = [];
            
            for (const line of stdout.trim().split('\n')) {
                if (!line) continue;
                const [name, windows, attached] = line.split(':');
                sessions.push({
                    name,
                    windows: parseInt(windows),
                    attached: attached === '1',
                    id: name
                });
            }
            
            console.log(`Found ${sessions.length} tmux sessions`);
            return sessions;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to list sessions: ${error.message}`);
            return [];
        }
    }

    /**
     * Check if a session with the given name exists.
     * Harvested from: tmux_interface.py lines 65-82
     */
    async sessionExists(name) {
        try {
            await execAsync(`tmux has-session -t "${name}"`);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Create a new tmux session.
     * Simplified from: tmux_interface.py lines 84-167
     * Focused on single-pane session creation for Claude instances
     */
    async createSession(name, cwd = null, detached = true) {
        try {
            // Kill existing session if it exists
            if (await this.sessionExists(name)) {
                console.log(`Session ${name} already exists, killing it first`);
                await this.killSession(name);
            }

            // Create new session
            const sessionCwd = cwd || process.cwd();
            const detachFlag = detached ? '-d' : '';
            
            await execAsync(`tmux new-session ${detachFlag} -s "${name}" -c "${sessionCwd}"`);
            
            console.log(`Successfully created session: ${name}`);
            return true;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to create session ${name}: ${error.message}`);
            return false;
        }
    }

    /**
     * Kill a tmux session.
     * Harvested from: tmux_interface.py lines 181-203
     */
    async killSession(name) {
        try {
            await execAsync(`tmux kill-session -t "${name}"`);
            console.log(`Killed session: ${name}`);
            return true;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to kill session ${name}: ${error.message}`);
            return false;
        }
    }

    /**
     * Send keys to a tmux pane.
     * Harvested from: tmux_interface.py lines 343-372
     * Simplified to target format: "session_name:window.pane"
     */
    async sendKeys(target, keys, enter = false) {
        try {
            // Send the keys
            await execAsync(`tmux send-keys -t "${target}" "${keys}"`);
            console.log(`Sent keys to ${target}: ${keys}`);
            
            // Send Enter key if requested
            if (enter) {
                // Add delay to let Claude process the text before Enter
                await new Promise(resolve => setTimeout(resolve, 500));
                await execAsync(`tmux send-keys -t "${target}" "C-m"`);
                console.log(`Sent Enter key to ${target}`);
            }
            
            return true;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to send keys to ${target}: ${error.message}`);
            return false;
        }
    }

    /**
     * Capture the content of a tmux pane.
     * Harvested from: tmux_interface.py lines 374-393
     * CRITICAL FIX: Add session validation to prevent hanging
     */
    async capturePane(target, lines = null) {
        try {
            // CRITICAL: Validate session exists before capture to prevent hanging
            const sessionName = target.split(':')[0];
            const sessionExists = await this.sessionExists(sessionName);
            
            if (!sessionExists) {
                console.error(`!!! VALIDATION FAILED !!! Session ${sessionName} does not exist - skipping capture`);
                throw new Error(`Session ${sessionName} does not exist`);
            }
            
            const linesFlag = lines ? `-p -S -${lines}` : '-p';
            const { stdout } = await execAsync(`tmux capture-pane -t "${target}" ${linesFlag}`);
            return stdout;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to capture pane ${target}: ${error.message}`);
            throw error; // Don't return empty string, let caller handle failure
        }
    }

    /**
     * Get pane target for a session (defaults to first window, first pane).
     * Helper method for MCP operations.
     */
    getPaneTarget(sessionName, windowIndex = 0, paneIndex = 0) {
        return `${sessionName}:${windowIndex}.${paneIndex}`;
    }

    /**
     * Check if a pane is active (responsive).
     * New method for MCP server health checking.
     */
    async isPaneActive(target) {
        try {
            // Try to get pane info - if it fails, pane doesn't exist
            await execAsync(`tmux display-message -t "${target}" -p "#{pane_id}"`);
            return true;
        } catch (error) {
            return false;
        }
    }
}