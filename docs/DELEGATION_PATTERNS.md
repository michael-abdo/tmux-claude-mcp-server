# Delegation Patterns for tmux-claude Orchestration

## ⚠️ CRITICAL: DELEGATION IS MANDATORY ⚠️

This document outlines the MANDATORY delegation patterns that ALL Executive and Manager instances MUST follow.

## Core Principle: NO DIRECT IMPLEMENTATION

### What This Means

- **Executives**: NEVER write code, ONLY spawn Managers
- **Managers**: NEVER write code, ONLY spawn Specialists  
- **Specialists**: The ONLY role that implements code

### Why This Matters

1. **Scalability**: Enables parallel execution across multiple instances
2. **Clarity**: Each role has a clear, focused responsibility
3. **Quality**: Specialists can focus deeply on specific tasks
4. **Coordination**: Executives and Managers maintain the big picture

## Executive Delegation Patterns

### ❌ WRONG: Executive Implementing

```javascript
// NEVER DO THIS AS AN EXECUTIVE
const ui = await createReactComponent({
    name: 'Dashboard',
    props: ['data', 'user'],
    // ... implementation details ...
});
```

### ✅ CORRECT: Executive Delegating

```javascript
// ALWAYS DO THIS AS AN EXECUTIVE
const { instanceId } = await spawn({
    role: 'manager',
    workDir: projectDir,
    context: `You are the UI Manager.
    
    YOUR RESPONSIBILITY: Create all UI components for the dashboard.
    
    COMPONENTS NEEDED:
    1. Main Dashboard component
    2. Data visualization widgets
    3. User profile section
    
    REMEMBER: You must delegate ALL implementation to Specialists.`
});
```

## Manager Delegation Patterns

### ❌ WRONG: Manager Implementing

```javascript
// NEVER DO THIS AS A MANAGER
function implementNavigationBar() {
    const nav = document.createElement('nav');
    nav.className = 'main-navigation';
    // ... more implementation ...
}
```

### ✅ CORRECT: Manager Delegating

```javascript
// ALWAYS DO THIS AS A MANAGER
const specialists = await Promise.all([
    spawn({
        role: 'specialist',
        workDir: projectDir,
        context: `You are a UI Specialist.
        
        YOUR TASK: Implement the navigation bar component
        
        FILES TO CREATE/MODIFY:
        - src/components/NavigationBar.jsx
        - src/styles/navigation.css
        
        REQUIREMENTS:
        - Responsive design
        - Accessible (ARIA labels)
        - Smooth animations`
    }),
    spawn({
        role: 'specialist',
        workDir: projectDir,
        context: `You are a UI Specialist.
        
        YOUR TASK: Implement the footer component
        
        FILES TO CREATE/MODIFY:
        - src/components/Footer.jsx
        - src/styles/footer.css`
    })
]);
```

## Common Anti-Patterns to Avoid

### 1. The "Quick Fix" Trap

**Scenario**: "It's just one line of code, I'll do it myself"

**Problem**: This breaks the entire orchestration model

**Solution**: ALWAYS spawn a Specialist, even for small tasks

```javascript
// ❌ WRONG - Executive/Manager doing a "quick fix"
await fs.writeFile('config.json', JSON.stringify(config));

// ✅ CORRECT - Delegating even small tasks
await spawn({
    role: 'specialist',
    context: 'Update config.json with new settings...'
});
```

### 2. The "Helper Function" Trap

**Scenario**: "I'll just write a utility function to help"

**Problem**: Executives/Managers should NOT write ANY code

**Solution**: Create a Specialist specifically for utilities

```javascript
// ✅ CORRECT - Spawn a utilities Specialist
await spawn({
    role: 'specialist',
    context: `Create utility functions for the project.
    
    UTILITIES NEEDED:
    1. Date formatting helpers
    2. API response parsers
    3. Validation functions
    
    CREATE FILE: src/utils/helpers.js`
});
```

### 3. The "Configuration" Trap

**Scenario**: "It's just configuration, not real code"

**Problem**: Configuration IS code and should be delegated

**Solution**: Spawn a configuration Specialist

```javascript
// ✅ CORRECT - Configuration Specialist
await spawn({
    role: 'specialist',
    context: `Set up project configuration.
    
    TASKS:
    1. Create webpack.config.js
    2. Set up .env files
    3. Configure ESLint and Prettier
    4. Set up package.json scripts`
});
```

## Delegation Workflow Examples

### Example 1: Building a Web Application

```
User Request: "Build a task management web app"
    ↓
Executive:
    1. Creates PROJECT_PLAN.md
    2. Spawns Backend Manager
    3. Spawns Frontend Manager
    4. Spawns DevOps Manager
    ↓
Backend Manager:
    1. Plans API structure
    2. Spawns Database Specialist
    3. Spawns API Endpoint Specialist
    4. Spawns Authentication Specialist
    ↓
Frontend Manager:
    1. Plans UI components
    2. Spawns Layout Specialist
    3. Spawns Components Specialist
    4. Spawns Styling Specialist
    ↓
DevOps Manager:
    1. Plans deployment
    2. Spawns Docker Specialist
    3. Spawns CI/CD Specialist
```

### Example 2: Proper Task Breakdown

**Executive Context to Manager:**
```
You are the API Manager for our task management app.

FEATURES TO IMPLEMENT:
1. User authentication (login, logout, register)
2. Task CRUD operations
3. Project management
4. Team collaboration

REMEMBER: Break each feature into independent tasks for Specialists.
```

**Manager's Task Breakdown:**
```javascript
// Manager plans the work
const tasks = [
    {
        specialist: "auth-specialist",
        files: ["src/auth/login.js", "src/auth/register.js"],
        description: "Implement authentication endpoints"
    },
    {
        specialist: "task-specialist", 
        files: ["src/api/tasks.js", "src/models/Task.js"],
        description: "Implement task CRUD operations"
    },
    {
        specialist: "project-specialist",
        files: ["src/api/projects.js", "src/models/Project.js"],
        description: "Implement project management"
    }
];

// Manager spawns Specialists
for (const task of tasks) {
    await spawn({
        role: 'specialist',
        context: `Your task: ${task.description}
        Files to work on: ${task.files.join(', ')}`
    });
}
```

## Verification Checklist

Before proceeding with ANY task, ask yourself:

### For Executives:
- [ ] Have I created a PROJECT_PLAN.md?
- [ ] Am I spawning Managers, not implementing?
- [ ] Have I clearly communicated what needs delegation?
- [ ] Am I monitoring Manager progress?

### For Managers:
- [ ] Have I broken down the work into Specialist-sized tasks?
- [ ] Am I spawning Specialists, not implementing?
- [ ] Have I checked for file conflicts?
- [ ] Am I monitoring Specialist progress?

### For Specialists:
- [ ] Am I working only on my assigned files?
- [ ] Am I on my feature branch?
- [ ] Have I made atomic commits?
- [ ] Have I updated my todos?

## Emergency Procedures

### "I'm an Executive/Manager and I Started Coding!"

1. **STOP IMMEDIATELY**
2. Save your work plan (not code)
3. Spawn appropriate Manager/Specialist
4. Pass the requirements to them
5. Delete any code you wrote

### "I'm Not Sure If This Needs Delegation"

**Simple Rule**: If it involves creating or modifying files, it MUST be delegated.

This includes:
- Writing code
- Creating configuration files
- Writing documentation
- Creating tests
- Modifying existing files
- Running build scripts

## Summary

The delegation model is not optional - it's the foundation of the tmux-claude orchestration system. By following these patterns, we enable:

1. **Massive parallelization** - 10+ Specialists working simultaneously
2. **Clear accountability** - Each role has specific responsibilities
3. **Better quality** - Specialists focus deeply on their tasks
4. **Easier debugging** - Clear hierarchy makes issues traceable
5. **Scalable architecture** - Can handle projects of any size

Remember: **When in doubt, delegate!**