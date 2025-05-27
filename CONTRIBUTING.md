# Contributing to tmux-claude-mcp-server

Thank you for your interest in contributing! This guide will help you get started.

## Code of Conduct

Please be respectful and constructive in all interactions. We aim to maintain a welcoming environment for all contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/tmux-claude-mcp-server.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`

## Development Setup

1. Ensure you have Node.js 18+ and tmux 3.0+ installed
2. Copy `config/default.json` to `config/local.json` for local configuration
3. Run tests to verify setup: `npm test`

## Making Changes

### Code Style

- **JavaScript files**: Use camelCase naming (e.g., `instanceManager.js`)
- **Functions**: camelCase (e.g., `spawnInstance()`)
- **Classes**: PascalCase (e.g., `InstanceManager`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- Use 2 spaces for indentation
- Add JSDoc comments for public APIs

### Commit Messages

Follow conventional commits format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Test additions or modifications
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

Example:
```
feat(mcp): add retry logic to send tool

Implements exponential backoff for failed message sends.
Addresses issue #123
```

### Testing

- Add unit tests for new functionality in `tests/unit/`
- Add integration tests for cross-component features in `tests/integration/`
- Ensure all tests pass: `npm test`
- Aim for 80%+ code coverage for new code

### Documentation

- Update relevant documentation in `docs/`
- Add JSDoc comments for new functions/classes
- Update README.md if adding new features
- Include examples for new functionality

## Submitting Changes

1. Ensure all tests pass
2. Update documentation as needed
3. Commit your changes with a descriptive message
4. Push to your fork: `git push origin feature/your-feature-name`
5. Create a Pull Request with:
   - Clear description of changes
   - Link to any related issues
   - Screenshots/examples if applicable

## Pull Request Guidelines

- PRs should focus on a single feature or fix
- Keep changes small and reviewable
- Respond to review feedback constructively
- Ensure CI checks pass

## Reporting Issues

When reporting issues, please include:
- Node.js and tmux versions
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

## Questions?

Feel free to open an issue for questions or join discussions in existing issues.

Thank you for contributing!