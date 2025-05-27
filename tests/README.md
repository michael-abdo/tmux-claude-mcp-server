# Test Suite

This directory contains all tests for tmux-claude-mcp-server.

## Test Organization

### /unit
Unit tests for individual modules with mocked dependencies.

### /integration  
Integration tests that test multiple components working together.

### /e2e
End-to-end tests that spawn actual Claude instances and test full workflows.

### /performance
Performance benchmarks and stress tests.

### /fixtures
Test data and configuration files.

### /helpers
Shared test utilities and base classes.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test type
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run individual test file
node tests/unit/tmuxInterface.test.js
```

## Writing Tests

1. Name test files with `.test.js` suffix
2. Use descriptive test names
3. Follow AAA pattern: Arrange, Act, Assert
4. Mock external dependencies in unit tests
5. Use real components in integration tests

## Test Coverage

We aim for:
- 80%+ coverage for unit tests
- Critical paths covered by integration tests
- Major workflows covered by e2e tests