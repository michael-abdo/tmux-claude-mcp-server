#!/usr/bin/env node

/**
 * Test AI Conflict Resolution
 * Tests the AI-powered conflict resolution functionality
 */

import { AIConflictResolver } from '../../src/ai_conflict_resolver.js';
import { IntegrationTestBase, TestSuiteRunner } from '../helpers/base_test_class.js';
import fs from 'fs/promises';
import path from 'path';

class AIConflictTest extends IntegrationTestBase {
    async setup() {
        await super.setup();
        this.resolver = new AIConflictResolver();
        this.testWorkspace = await this.createSubdirectory('ai-conflict-test');
    }

    /**
     * Create a file with conflicts
     */
    async createConflictedFile(filename, ourContent, theirContent) {
        const content = `<<<<<<< HEAD
${ourContent}
=======
${theirContent}
>>>>>>> feature-branch`;
        
        const filePath = path.join(this.testWorkspace, filename);
        await fs.writeFile(filePath, content);
        return filePath;
    }
}

// Create test suite
const suite = new TestSuiteRunner('AI Conflict Resolution Tests');

// Test 1: Parse simple conflict
suite.addTest('Parse Simple Conflict', AIConflictTest, async function() {
    const filePath = await this.createConflictedFile(
        'simple.js',
        'const value = 42;',
        'const value = 100;'
    );

    const parsed = await this.resolver.parseConflicts(filePath);
    
    this.assert(parsed.hasConflicts, 'Should detect conflicts');
    this.assertEqual(parsed.conflicts.length, 1, 'Should have one conflict');
    
    const conflict = parsed.conflicts[0];
    this.assertEqual(conflict.ours.join(''), 'const value = 42;', 'Should parse ours correctly');
    this.assertEqual(conflict.theirs.join(''), 'const value = 100;', 'Should parse theirs correctly');
});

// Test 2: Parse multiple conflicts
suite.addTest('Parse Multiple Conflicts', AIConflictTest, async function() {
    const content = `function example() {
<<<<<<< HEAD
    console.log('version 1');
=======
    console.log('version 2');
>>>>>>> feature
    
    const data = {
<<<<<<< HEAD
        name: 'Alice',
        age: 30
=======
        name: 'Bob',
        age: 25
>>>>>>> feature
    };
}`;

    const filePath = path.join(this.testWorkspace, 'multiple.js');
    await fs.writeFile(filePath, content);
    
    const parsed = await this.resolver.parseConflicts(filePath);
    
    this.assert(parsed.hasConflicts, 'Should detect conflicts');
    this.assertEqual(parsed.conflicts.length, 2, 'Should have two conflicts');
});

// Test 3: Analyze code semantics
suite.addTest('Analyze Code Semantics', AIConflictTest, async function() {
    const functionCode = `function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}`;
    
    const semantics = this.resolver.analyzeCodeSemantics(functionCode);
    
    this.assert(semantics.isFunction, 'Should detect function');
    this.assert(!semantics.isClass, 'Should not detect class');
    this.assert(!semantics.isImport, 'Should not detect import');
});

// Test 4: Generate resolution prompt
suite.addTest('Generate Resolution Prompt', AIConflictTest, async function() {
    const conflict = {
        ours: ['const config = { debug: true };'],
        theirs: ['const config = { debug: false };'],
        oursBranch: 'HEAD',
        theirsBranch: 'feature-branch'
    };
    
    const prompt = this.resolver.generateResolutionPrompt(conflict, {
        filePath: 'config.js',
        projectInfo: 'Production deployment configuration'
    });
    
    this.assert(prompt.includes('debug: true'), 'Prompt should include our version');
    this.assert(prompt.includes('debug: false'), 'Prompt should include their version');
    this.assert(prompt.includes('Production deployment'), 'Prompt should include context');
});

// Test 5: Assess resolution confidence
suite.addTest('Assess Resolution Confidence', AIConflictTest, async function() {
    const conflict = {
        ours: ['const value = 42;', 'console.log(value);'],
        theirs: ['const value = 100;', 'console.log(value);']
    };
    
    // Test high confidence (includes elements from both)
    const goodResolution = 'const value = process.env.DEBUG ? 42 : 100;\nconsole.log(value);';
    const highConfidence = this.resolver.assessResolutionConfidence(conflict, goodResolution);
    this.assert(highConfidence > 0.5, 'Should have high confidence for good resolution');
    
    // Test low confidence (very different)
    const badResolution = 'throw new Error("Conflict!");';
    const lowConfidence = this.resolver.assessResolutionConfidence(conflict, badResolution);
    this.assert(lowConfidence < 0.5, 'Should have low confidence for bad resolution');
});

// Test 6: Apply resolutions
suite.addTest('Apply Resolutions', AIConflictTest, async function() {
    const content = `function test() {
<<<<<<< HEAD
    return 'version A';
=======
    return 'version B';
>>>>>>> feature
}`;

    const filePath = path.join(this.testWorkspace, 'apply.js');
    await fs.writeFile(filePath, content);
    
    const parsed = await this.resolver.parseConflicts(filePath);
    const resolutions = [{
        conflict: parsed.conflicts[0],
        resolution: "    return process.env.USE_A ? 'version A' : 'version B';"
    }];
    
    const resolved = this.resolver.applyResolutions(parsed, resolutions);
    
    this.assert(!resolved.includes('<<<<<<<'), 'Should remove conflict markers');
    this.assert(resolved.includes('process.env.USE_A'), 'Should include resolution');
    this.assert(resolved.includes('function test()'), 'Should preserve non-conflicted code');
});

// Test 7: Complex conflict with nested structures
suite.addTest('Complex Nested Conflict', AIConflictTest, async function() {
    const content = `const config = {
    server: {
<<<<<<< HEAD
        port: 3000,
        host: 'localhost',
        ssl: false
=======
        port: 443,
        host: '0.0.0.0',
        ssl: true,
        cert: '/path/to/cert'
>>>>>>> production
    }
};`;

    const filePath = path.join(this.testWorkspace, 'complex.js');
    await fs.writeFile(filePath, content);
    
    const parsed = await this.resolver.parseConflicts(filePath);
    
    this.assert(parsed.hasConflicts, 'Should detect complex conflicts');
    const conflict = parsed.conflicts[0];
    this.assert(conflict.ours.some(line => line.includes('port: 3000')), 'Should parse nested ours');
    this.assert(conflict.theirs.some(line => line.includes('port: 443')), 'Should parse nested theirs');
});

// Test 8: File history extraction
suite.addTest('File History Extraction', AIConflictTest, async function() {
    // Initialize git in test workspace
    await this.execInEnv('git init', { cwd: this.testWorkspace });
    await this.execInEnv('git config user.email "test@test.com"', { cwd: this.testWorkspace });
    await this.execInEnv('git config user.name "Test"', { cwd: this.testWorkspace });
    
    // Create file with history
    const testFile = path.join(this.testWorkspace, 'history.js');
    await fs.writeFile(testFile, 'const version = 1;');
    await this.execInEnv('git add history.js', { cwd: this.testWorkspace });
    await this.execInEnv('git commit -m "Initial version"', { cwd: this.testWorkspace });
    
    await fs.writeFile(testFile, 'const version = 2;');
    await this.execInEnv('git add history.js', { cwd: this.testWorkspace });
    await this.execInEnv('git commit -m "Update version"', { cwd: this.testWorkspace });
    
    const history = await this.resolver.getFileHistory(testFile, this.testWorkspace);
    
    this.assert(history.includes('Initial version'), 'Should include commit messages');
    this.assert(history.includes('Update version'), 'Should include recent commits');
});

// Test 9: Project context detection
suite.addTest('Project Context Detection', AIConflictTest, async function() {
    // Create package.json
    const packageJson = {
        name: 'test-project',
        description: 'AI conflict resolution test project'
    };
    await fs.writeFile(
        path.join(this.testWorkspace, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
    
    const context = await this.resolver.getProjectContext(this.testWorkspace);
    
    this.assert(context.includes('test-project'), 'Should detect project name');
    this.assert(context.includes('AI conflict resolution'), 'Should include description');
});

// Test 10: Generate resolution report
suite.addTest('Generate Resolution Report', AIConflictTest, async function() {
    const result = {
        confidence: 0.85,
        resolutions: [
            {
                conflict: {
                    ours: ['const debug = true;'],
                    theirs: ['const debug = false;']
                },
                resolution: 'const debug = process.env.NODE_ENV !== "production";',
                confidence: 0.85
            }
        ]
    };
    
    const report = this.resolver.generateReport(result);
    
    this.assert(report.includes('# AI Conflict Resolution Report'), 'Should have title');
    this.assert(report.includes('85.0%'), 'Should show confidence percentage');
    this.assert(report.includes('const debug = true;'), 'Should show original');
    this.assert(report.includes('const debug = false;'), 'Should show incoming');
    this.assert(report.includes('process.env.NODE_ENV'), 'Should show resolution');
});

// Run the test suite
console.log('🤖 Running AI Conflict Resolution Tests\n');
const results = await suite.run();

// Exit with appropriate code
process.exit(results.some(r => !r.success) ? 1 : 0);