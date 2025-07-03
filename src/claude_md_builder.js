/**
 * CLAUDE.md Builder
 * Generates context-aware CLAUDE.md files for instances based on their role and location
 * Following the "meet them where they are" principle
 */

export function buildClaudeMd(role, instanceId, workDir, parentId = null, projectContext = '') {
    const timestamp = new Date().toISOString();
    const parentDir = workDir.replace(/\/[^\/]+$/, '');
    
    // Common header for all instances
    const header = `# Instance Context - ${instanceId}
Generated: ${timestamp}

## 🗺️ YOUR LOCATION & IDENTITY
- **Instance ID**: ${instanceId}
- **Role**: ${role}
- **Working Directory**: ${workDir}
- **Parent Directory**: ${parentDir}
- **Parent Instance**: ${parentId || 'Primary Claude'}

## 🚀 QUICK START COMMANDS
\`\`\`bash
# Where am I?
pwd

# What files do I have?
ls -la

# What's in parent directory?
ls -la ..
\`\`\`
`;

    // Role-specific content
    let roleContent = '';
    
    switch(role) {
        case 'executive':
            roleContent = buildExecutiveClaudeMd(instanceId, workDir, parentId);
            break;
        case 'manager':
            roleContent = buildManagerClaudeMd(instanceId, workDir, parentId);
            break;
        case 'specialist':
            roleContent = buildSpecialistClaudeMd(instanceId, workDir, parentId);
            break;
    }
    
    // Project-specific context
    const projectSection = projectContext ? `
## 📋 PROJECT-SPECIFIC CONTEXT
${projectContext}
` : '';

    return header + roleContent + projectSection;
}

function buildExecutiveClaudeMd(instanceId, workDir, parentId) {
    const mcpBridgePath = '../scripts/mcp_bridge.js';
    
    return `
## YOUR EXECUTIVE RESPONSIBILITIES
1. Read project requirements
2. Create strategic plans (PROJECT_PLAN.md, DESIGN_SYSTEM.md)
3. Spawn and coordinate managers
4. Monitor progress
5. Verify functional completion

## 📋 MCP BRIDGE COMMANDS (Copy & Paste Ready)

### List All Instances
\`\`\`bash
node ${mcpBridgePath} list '{}'
\`\`\`

### Spawn Manager (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} spawn '{"role":"manager","workDir":"${workDir}","context":"[MANAGER INSTRUCTIONS]","parentId":"${instanceId}"}'
\`\`\`

### Send Message to Manager (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} send '{"instanceId":"[MANAGER_ID]","text":"[MESSAGE]"}'
\`\`\`

### Read Manager Output (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} read '{"instanceId":"[MANAGER_ID]","lines":50}'
\`\`\`

## WORKFLOW REMINDERS
- Always test actual functionality, not just file existence
- Send design system to ALL managers before they start
- Require technology stack confirmation from each manager
- Monitor progress every 5-10 minutes
`;
}

function buildManagerClaudeMd(instanceId, workDir, parentId) {
    const mcpBridgePath = '../scripts/mcp_bridge.js';
    
    return `
## YOUR MANAGER RESPONSIBILITIES
1. Understand your assigned domain
2. Plan implementation approach
3. Either implement directly OR spawn specialists (check with Executive)
4. Coordinate work and integration
5. Report functional completion

## 📋 MCP BRIDGE COMMANDS (Copy & Paste Ready)

### List All Instances
\`\`\`bash
node ${mcpBridgePath} list '{}'
\`\`\`

### IF SPAWNING SPECIALISTS:

#### Spawn Specialist (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} spawn '{"role":"specialist","workDir":"${workDir}","context":"[SPECIALIST TASK]","parentId":"${instanceId}"}'
\`\`\`

#### Send Message to Specialist (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} send '{"instanceId":"[SPECIALIST_ID]","text":"[MESSAGE]"}'
\`\`\`

#### Read Specialist Output (MODIFY THEN RUN)
\`\`\`bash
node ${mcpBridgePath} read '{"instanceId":"[SPECIALIST_ID]","lines":50}'
\`\`\`

## IMPLEMENTATION REMINDERS
- Check if you should implement directly or spawn specialists
- All work goes in: ${workDir}
- Coordinate with other managers through Executive
- Test functionality before reporting completion
`;
}

function buildSpecialistClaudeMd(instanceId, workDir, parentId) {
    return `
## YOUR SPECIALIST RESPONSIBILITIES
1. Implement your assigned task directly
2. Write functional code, not placeholders
3. Test your implementation
4. Report completion to your manager

## 📋 AVAILABLE TOOLS (Copy & Paste Ready)

### File Operations
\`\`\`python
# Read a file
Read("filename.html")

# Write a new file  
Write("filename.html", """
Your content here
""")

# Edit existing file
Edit("filename.html", "old text", "new text")

# List directory
LS(".")
\`\`\`

### Testing Commands
\`\`\`bash
# Open HTML in browser (Mac)
Bash("open index.html")

# Start local server
Bash("python -m http.server 8000")

# Check your work
Bash("ls -la")
\`\`\`

## WORK LOCATION
- All your files go in: ${workDir}
- Your manager is: ${parentId}
- Focus only on your assigned task
- No spawning or delegation available
`;
}

/**
 * Create a CLAUDE.md file for an instance
 */
export async function writeClaudeMd(fs, instanceId, role, workDir, parentId, projectContext) {
    const claudeMdContent = buildClaudeMd(role, instanceId, workDir, parentId, projectContext);
    const claudeMdPath = `${workDir}/CLAUDE.md`;
    
    await fs.writeFile(claudeMdPath, claudeMdContent);
    return claudeMdPath;
}