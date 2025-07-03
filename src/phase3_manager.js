/**
 * Phase 3 Manager Implementation
 * 
 * Example Manager implementation that demonstrates how to use the
 * parallel execution capabilities. This shows how a Manager Claude
 * instance would coordinate multiple Specialists in parallel.
 */

import { ParallelExecutor } from './parallel_executor.js';

/**
 * Example task definitions for parallel execution
 */
export const exampleTasks = {
    // Example: Building an authentication system with parallel tasks
    authSystemTasks: [
        {
            id: 'user-model',
            name: 'User Model Implementation',
            context: `# Specialist: User Model
            
You are responsible for implementing the User model with Mongoose.

Requirements:
- Email field (unique, required, validated)
- Password field (hashed with bcrypt)
- Refresh tokens array
- Timestamps (createdAt, updatedAt)
- Methods: comparePassword, generateAuthToken
- Pre-save hook for password hashing`,
            instruction: 'Please implement the User model in models/User.js with all requirements including tests.',
            completionPattern: 'User model.*complete|models/User.js.*created'
        },
        {
            id: 'auth-middleware',
            name: 'Authentication Middleware',
            context: `# Specialist: Auth Middleware
            
You are responsible for implementing JWT authentication middleware.

Requirements:
- Verify JWT tokens from Authorization header
- Support both access and refresh tokens
- Handle token expiration gracefully
- Attach user object to request
- Proper error responses`,
            instruction: 'Please implement the auth middleware in middleware/auth.js with comprehensive error handling.',
            completionPattern: 'middleware.*complete|middleware/auth.js.*created'
        },
        {
            id: 'auth-controller',
            name: 'Auth Controller',
            context: `# Specialist: Auth Controller
            
You are responsible for implementing authentication endpoints.

Endpoints:
- POST /auth/register - User registration
- POST /auth/login - User login with email/password
- POST /auth/refresh - Refresh access token
- POST /auth/logout - Logout and invalidate refresh token
- GET /auth/me - Get current user`,
            instruction: 'Please implement the auth controller in controllers/authController.js with all endpoints.',
            completionPattern: 'controller.*complete|controllers/authController.js.*created'
        },
        {
            id: 'auth-tests',
            name: 'Authentication Tests',
            context: `# Specialist: Auth Tests
            
You are responsible for comprehensive testing of the auth system.

Test coverage:
- User model unit tests
- Middleware unit tests  
- Integration tests for all endpoints
- Edge cases and error scenarios
- Performance tests for bcrypt operations`,
            instruction: 'Please implement comprehensive tests in the __tests__ directory.',
            completionPattern: 'all tests pass|test suite.*complete'
        }
    ],

    // Example: Building a REST API with parallel component development
    apiSystemTasks: [
        {
            id: 'database-setup',
            name: 'Database Configuration',
            context: `# Specialist: Database Setup
            
Set up MongoDB connection and configuration.

Requirements:
- Connection pooling
- Error handling and reconnection
- Environment-based config
- Connection event logging`,
            instruction: 'Please implement database configuration in config/database.js',
            completionPattern: 'database.*configured|config/database.js.*created'
        },
        {
            id: 'error-handling',
            name: 'Error Handling System',
            context: `# Specialist: Error Handling
            
Implement centralized error handling.

Requirements:
- Custom error classes
- Global error middleware
- Async error wrapper
- Error logging with context`,
            instruction: 'Please implement error handling in middleware/errorHandler.js and utils/AppError.js',
            completionPattern: 'error handling.*complete'
        },
        {
            id: 'validation-system',
            name: 'Request Validation',
            context: `# Specialist: Validation System
            
Implement request validation using Joi.

Requirements:
- Validation middleware factory
- Common validation schemas
- Custom error messages
- Request sanitization`,
            instruction: 'Please implement validation system in middleware/validation.js',
            completionPattern: 'validation.*complete|middleware/validation.js.*created'
        }
    ]
};

/**
 * Manager class that coordinates parallel specialist execution
 */
export class Phase3Manager {
    constructor(mcpTools, options = {}) {
        this.mcpTools = mcpTools;
        this.executor = new ParallelExecutor(mcpTools, {
            maxConcurrent: options.maxConcurrent || 3
        });
        this.managerId = options.managerId;
        this.workDir = options.workDir;
    }

    /**
     * Execute a job with parallel specialists.
     * This method would be called by the Manager Claude instance.
     */
    async executeJob(jobSpec) {
        console.log(`Manager ${this.managerId} starting job: ${jobSpec.name}`);
        
        try {
            // Start execution timer
            const startTime = Date.now();
            
            // Execute tasks in parallel
            const results = await this.executor.executeParallel(
                jobSpec.tasks,
                this.managerId,
                this.workDir
            );
            
            // Calculate execution time
            const executionTime = Date.now() - startTime;
            
            // Log results
            console.log(`Job ${jobSpec.name} completed:`);
            console.log(`- Total tasks: ${results.total}`);
            console.log(`- Completed: ${results.completed}`);
            console.log(`- Failed: ${results.failed}`);
            console.log(`- Execution time: ${Math.round(executionTime / 1000)}s`);
            
            // Report back to Executive
            await this.reportToExecutive(jobSpec, results, executionTime);
            
            return results;
            
        } catch (error) {
            console.error(`Job ${jobSpec.name} failed:`, error);
            throw error;
        }
    }

    /**
     * Report job results back to Executive
     */
    async reportToExecutive(jobSpec, results, executionTime) {
        // In a real implementation, this would use MCP tools to communicate
        // with the Executive instance
        const report = {
            job: jobSpec.name,
            status: results.failed === 0 ? 'SUCCESS' : 'PARTIAL_FAILURE',
            summary: {
                total: results.total,
                completed: results.completed,
                failed: results.failed,
                executionTimeMs: executionTime
            },
            completedTasks: results.completedTasks.map(t => ({
                name: t.task.name,
                specialist: t.specialist,
                duration: t.duration
            })),
            failedTasks: results.failedTasks.map(t => ({
                name: t.task.name,
                error: t.error,
                attempts: t.attempts
            }))
        };
        
        console.log('Job completion report:', JSON.stringify(report, null, 2));
        
        // Would send this to Executive via MCP
        // await this.mcpTools.send({
        //     instanceId: this.executiveId,
        //     text: `Job completed: ${JSON.stringify(report)}`
        // });
    }

    /**
     * Monitor ongoing parallel execution
     */
    async getExecutionStatus() {
        return this.executor.getStatus();
    }

    /**
     * Emergency stop all specialists
     */
    async emergencyStop() {
        console.log(`Manager ${this.managerId} initiating emergency stop`);
        await this.executor.emergencyStop();
    }
}

/**
 * Example usage showing how a Manager would execute parallel tasks
 */
export async function demonstrateParallelExecution(mcpTools) {
    // This would normally be done by a Manager Claude instance
    const manager = new Phase3Manager(mcpTools, {
        managerId: 'mgr_1_1',
        workDir: '/tmp/test-parallel',
        maxConcurrent: 3
    });
    
    // Execute auth system job with 4 parallel tasks
    const authJob = {
        name: 'Authentication System',
        tasks: exampleTasks.authSystemTasks
    };
    
    try {
        const results = await manager.executeJob(authJob);
        console.log('Parallel execution completed successfully');
        return results;
    } catch (error) {
        console.error('Parallel execution failed:', error);
        throw error;
    }
}