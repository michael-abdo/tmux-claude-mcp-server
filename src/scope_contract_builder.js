/**
 * Scope Contract Builder
 * Creates explicit scope boundaries for managers to prevent scope creep
 * Implements the "Global Context, Local Scope" architecture
 */

/**
 * Build a scope contract for a manager
 * @param {Object} params - Contract parameters
 * @param {string} params.projectOverview - Complete project description
 * @param {Array} params.yourScope - Specific responsibilities 
 * @param {Array} params.notYourScope - Explicit exclusions
 * @param {Array} params.coordinationPoints - Handoff requirements
 * @param {Array} params.successCriteria - Completion definition
 * @param {string} params.managerId - Manager instance ID
 * @param {string} params.managerRole - Manager role name
 * @returns {string} - Complete scope contract
 */
export function buildScopeContract({
    projectOverview,
    yourScope,
    notYourScope,
    coordinationPoints,
    successCriteria,
    managerId,
    managerRole
}) {
    return `# SCOPE CONTRACT FOR ${managerRole}
Manager ID: ${managerId}

## 🌍 PROJECT OVERVIEW (Read-Only Context)
${projectOverview}

## 🎯 YOUR SCOPE (Your Responsibility)
YOU are responsible for EXACTLY these deliverables:
${yourScope.map(item => `✅ ${item}`).join('\n')}

**SCOPE RULE**: Work ONLY on items marked with ✅ above.

## 🚫 SCOPE BOUNDARIES (Explicit Exclusions)
YOU are NOT responsible for:
${notYourScope.map(item => `❌ ${item}`).join('\n')}

**BOUNDARY RULE**: DO NOT work on items marked with ❌ above, even if you see issues.

## 🔗 COORDINATION INTERFACES (Handoff Points)
Your work must coordinate with others:
${coordinationPoints.map(point => `• ${point}`).join('\n')}

## 📋 SUCCESS CRITERIA (How You Know You're Done)
Report completion when ALL of these are true:
${successCriteria.map(criteria => `✅ ${criteria}`).join('\n')}

**COMPLETION RULE**: Report done when YOUR scope is complete. Do not wait for others.

## ⚠️ SCOPE VIOLATION PREVENTION
If you find yourself:
- Working on items marked with ❌ → STOP immediately
- Waiting for other managers → STOP, complete your scope first  
- Doing "integration work" → STOP, that's the Executive's job
- Creating files outside your scope → STOP, delegate back to Executive

**Remember**: Your success is measured by completing YOUR scope perfectly, not by doing other managers' work.
`;
}

/**
 * Build scope contract for a landing/product pages manager
 */
export function buildLandingPagesManagerContract(managerId, projectOverview) {
    return buildScopeContract({
        projectOverview,
        yourScope: [
            "index.html - Landing page with hero section and featured products",
            "products.html - Product catalog with filtering and all 6 AI agents",
            "product-detail.html - Detailed product information with pricing tiers"
        ],
        notYourScope: [
            "cart.html (Manager 2's responsibility)",
            "checkout.html (Manager 2's responsibility)",
            "Integration testing (Executive's responsibility)",
            "Overall project coordination (Executive's responsibility)",
            "README.md creation (Executive's responsibility)"
        ],
        coordinationPoints: [
            "Follow DESIGN_SYSTEM.md exactly for navigation consistency",
            "Ensure product detail pages have 'Add to Cart' buttons that save to localStorage",
            "Use identical navigation bar and footer from DESIGN_SYSTEM.md",
            "Link 'Add to Cart' buttons to cart.html (Manager 2 will implement cart page)"
        ],
        successCriteria: [
            "All 3 assigned HTML files exist and are functional",
            "Navigation works between your 3 pages",
            "Product catalog shows all 6 AI agents with correct pricing", 
            "Add to cart functionality saves items to localStorage",
            "Pages follow DESIGN_SYSTEM.md color scheme and styling exactly",
            "Responsive design works on desktop and mobile",
            "All internal links work (no broken links within your scope)"
        ],
        managerId,
        managerRole: "Landing & Product Pages Manager"
    });
}

/**
 * Build scope contract for a cart/checkout manager
 */
export function buildCartCheckoutManagerContract(managerId, projectOverview) {
    return buildScopeContract({
        projectOverview,
        yourScope: [
            "cart.html - Shopping cart page with item management and checkout button",
            "checkout.html - Checkout form with billing, shipping, and order summary"
        ],
        notYourScope: [
            "index.html (Manager 1's responsibility)",
            "products.html (Manager 1's responsibility)",
            "product-detail.html (Manager 1's responsibility)",
            "Integration testing (Executive's responsibility)",
            "Overall project coordination (Executive's responsibility)",
            "README.md creation (Executive's responsibility)"
        ],
        coordinationPoints: [
            "Follow DESIGN_SYSTEM.md exactly for navigation consistency",
            "Read cart items from localStorage (Manager 1 will populate this)",
            "Use identical navigation bar and footer from DESIGN_SYSTEM.md",
            "Ensure cart count in navigation updates correctly",
            "Link back to products.html for 'Continue Shopping'"
        ],
        successCriteria: [
            "Both assigned HTML files exist and are functional",
            "Cart displays items from localStorage correctly",
            "Cart allows quantity changes and item removal",
            "Cart calculates totals (subtotal, tax, total) correctly",
            "Checkout form has proper validation and error messages",
            "Checkout success clears cart and shows confirmation",
            "Pages follow DESIGN_SYSTEM.md color scheme and styling exactly",
            "Responsive design works on desktop and mobile"
        ],
        managerId,
        managerRole: "Cart & Checkout Manager"
    });
}

/**
 * Wrap a scope contract with the manager's role template
 */
export function buildManagerContextWithScopeContract(scopeContract, managerId, workDir, parentId) {
    const mcpBridgePath = '../scripts/mcp_bridge.js';
    
    return `You are manager with ID ${managerId}

## 🗺️ YOUR CURRENT LOCATION
- **Your working directory**: ${workDir}
- **Your instance ID**: ${managerId}
- **Your parent (Executive) ID**: ${parentId || 'unknown'}
- **MCP Bridge location**: ${mcpBridgePath} (relative to your directory)

${scopeContract}

## 📋 COPY-PASTE MCP BRIDGE COMMANDS

Use these EXACT commands from your current directory:

### List All Active Instances
\`\`\`bash
node ${mcpBridgePath} list '{}'
\`\`\`

### IF YOU NEED TO SPAWN SPECIALISTS:

#### Spawn Specialist (COPY AND MODIFY)
\`\`\`bash
node ${mcpBridgePath} spawn '{"role":"specialist","workDir":"${workDir}","context":"[SPECIALIST TASK HERE]","parentId":"${managerId}"}'
\`\`\`
**Replace [SPECIALIST TASK HERE] with specific implementation task**

#### Monitor Specialist (COPY AND MODIFY)
\`\`\`bash
node ${mcpBridgePath} read '{"instanceId":"[SPECIALIST_ID]","lines":50}'
\`\`\`
**Replace [SPECIALIST_ID] with actual specialist ID**

#### Send Message to Specialist (COPY AND MODIFY)
\`\`\`bash
node ${mcpBridgePath} send '{"instanceId":"[SPECIALIST_ID]","text":"[YOUR MESSAGE]"}'
\`\`\`

## Important Instructions

1. **FOLLOW YOUR SCOPE CONTRACT EXACTLY** - Do not work outside your assigned scope
2. Create a todo list for your assigned tasks only
3. Either implement directly OR spawn specialists (check with Executive)
4. Coordinate work through your defined interface points
5. Report completion when YOUR scope is finished

When ready, respond with: "READY: ${managerId} - scope contract understood"`;
}