# Delegation Workflow Template

## For Sending Complex Projects to Executives

### ✅ Correct Format

```
🚨 EXECUTIVE TASK: Plan and delegate the following project 🚨

DO NOT IMPLEMENT ANYTHING YOURSELF. Your job is to:
1. Create a PROJECT_PLAN.md with work breakdown
2. Spawn Manager instances for each major component
3. Send detailed instructions to each Manager
4. Monitor their progress

PROJECT: [Project Name]

[Project requirements and specifications here...]

DELEGATION STRUCTURE:
- Frontend Manager: Handle all UI/UX work
- Backend Manager: Handle API and business logic
- Database Manager: Handle schema and data layer
- DevOps Manager: Handle deployment and infrastructure

Remember: You coordinate, Managers organize, Specialists implement.
```

### ❌ Wrong Format (What we did before)

```
I want you to build a Grid Trading Bot Dashboard...
Please start with project setup and database configuration...
```

This format led the executive to implement directly instead of delegating.

### 📝 Example: Grid Trading Bot Dashboard (Corrected)

```
🚨 EXECUTIVE TASK: Orchestrate the Grid Trading Bot Dashboard project 🚨

DO NOT IMPLEMENT ANYTHING. Your responsibilities:
1. Create PROJECT_PLAN.md breaking down the work
2. Spawn these Manager instances:
   - Frontend Manager (React/TypeScript/UI)
   - Backend Manager (Deno/Supabase/API)
   - Database Manager (PostgreSQL/Schema)
3. Delegate specific tasks to each Manager
4. Monitor and coordinate their work

PROJECT REQUIREMENTS:
The Grid Trading Bot Dashboard should have:
- Modern React 18 frontend with TypeScript
- Deno backend with Supabase integration
- PostgreSQL database with proper schema
- Real-time features using Supabase subscriptions
- Trading bot management capabilities
- Analytics and reporting features
- Security and error handling

DELIVERABLES YOU SHOULD TRACK:
✓ PROJECT_PLAN.md created
✓ All Managers spawned and briefed
✓ Managers have spawned their Specialists
✓ Regular progress updates from all teams
✓ Integration points coordinated
✓ Final system tested and documented

START BY: Writing PROJECT_PLAN.md, then spawning your first Manager.
```

## 🎯 Key Principles

1. **Role Prefix**: Always start with "EXECUTIVE TASK:" or similar
2. **Explicit Prohibition**: State "DO NOT IMPLEMENT ANYTHING"
3. **Clear Steps**: List the delegation steps explicitly
4. **Delegation Structure**: Suggest Manager breakdown
5. **Deliverable Tracking**: Focus on coordination metrics
6. **Action Prompt**: End with delegation action, not implementation

## 🔍 Verification Messages

Before sending complex workflows:

```
Send: "Confirm your role and primary responsibility."
Expected: "I am an Executive. I orchestrate projects by creating plans and delegating to Managers. I never implement code directly."

Send: "What tools will you use for this project?"
Expected: "I will use spawn to create Managers, send to communicate, read to monitor, and Write only for PROJECT_PLAN.md."
```

## 🛑 Warning Signs

If you see an Executive doing any of these, intervene immediately:
- Using Edit/MultiEdit on code files
- Creating implementation files
- Writing actual code
- Working without Managers
- Not creating PROJECT_PLAN.md first

## 📋 Delegation Checklist

- [ ] Message starts with role clarification
- [ ] Explicitly prohibits implementation
- [ ] Describes delegation steps
- [ ] Suggests Manager structure
- [ ] Focuses on coordination metrics
- [ ] Ends with delegation action
- [ ] Avoids implementation verbs (build, create, implement)
- [ ] Uses coordination verbs (orchestrate, delegate, coordinate)