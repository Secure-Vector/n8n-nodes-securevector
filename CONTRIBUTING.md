# Contributing to n8n-nodes-securevector

Thank you for your interest in contributing! This document provides guidelines for contributing to the SecureVector n8n node.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Code Quality Standards](#code-quality-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Enhancements](#suggesting-enhancements)
- [License](#license)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect:

- Professional and courteous communication
- Constructive feedback and collaboration
- Respect for diverse viewpoints and experiences
- Focus on what's best for the community

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- n8n installed (for testing)
- TypeScript knowledge
- Familiarity with n8n concepts

### Setup Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/n8n-nodes-securevector.git
   cd n8n-nodes-securevector
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/Secure-Vector/n8n-nodes-securevector.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build the project**:
   ```bash
   npm run build
   ```

6. **Run tests**:
   ```bash
   npm test
   ```

## Development Process

### Our Workflow

We follow a Test-Driven Development (TDD) approach as defined in our project constitution:

1. **Write Tests First** ✅
2. **Get Approval** (for significant changes)
3. **Verify Tests Fail** (Red)
4. **Implement Feature** (Green)
5. **Refactor** while tests pass
6. **Submit PR**

### TDD is Non-Negotiable

**Before writing any code**:

```typescript
// 1. Write the test
describe('SecureVector Node', () => {
  it('should validate empty prompts', async () => {
    // Test that empty prompts are rejected
    expect(() => validatePrompt('')).toThrow('Prompt cannot be empty');
  });
});

// 2. Run test - it should FAIL
// 3. Now implement the function
function validatePrompt(prompt: string): void {
  if (!prompt) {
    throw new Error('Prompt cannot be empty');
  }
}

// 4. Run test - it should PASS
```

### Branching Strategy

- `master` - Stable release branch
- `feature/xxx` - New features
- `fix/xxx` - Bug fixes
- `docs/xxx` - Documentation updates

### Creating a Branch

```bash
# Update your master branch
git checkout master
git pull upstream master

# Create feature branch
git checkout -b feature/amazing-feature
```

## Code Quality Standards

All contributions must meet these requirements (from our constitution):

### TypeScript-First

- ✅ Strict mode enabled (`strict: true`)
- ✅ No `any` types without explicit justification
- ✅ All functions have explicit return types
- ✅ All parameters are typed

**Good**:
```typescript
function scanPrompt(prompt: string, timeout: number): Promise<ScanResponse> {
  // Implementation
}
```

**Bad**:
```typescript
function scanPrompt(prompt, timeout) {  // ❌ No types
  // Implementation
}
```

### Test Coverage

- ✅ Minimum 80% overall coverage
- ✅ 100% coverage for security-critical paths
- ✅ Unit tests for all business logic
- ✅ Integration tests for n8n operations

```bash
# Check coverage
npm run test:coverage

# Coverage must be >= 80%
```

### Code Style

- ✅ ESLint passes: `npm run lint`
- ✅ Prettier formatted: `npm run format`
- ✅ Max function length: 50 lines
- ✅ Max file length: 300 lines
- ✅ Cyclomatic complexity: ≤10

```bash
# Auto-fix style issues
npm run lint:fix
npm run format
```

### Documentation

- ✅ JSDoc comments for all public APIs
- ✅ Clear function and variable names
- ✅ Update README.md for user-facing changes
- ✅ Update CHANGELOG.md

**Example JSDoc**:
```typescript
/**
 * Validates a prompt before sending to SecureVector API
 *
 * @param prompt - The text prompt to validate
 * @param maxLength - Maximum allowed length (default: 10000)
 * @returns True if valid
 * @throws {NodeOperationError} If prompt is invalid
 */
function validatePrompt(prompt: string, maxLength = 10000): boolean {
  // Implementation
}
```

## Submitting Changes

### Before You Submit

Run this checklist:

```bash
# 1. All tests pass
npm test

# 2. Type checking passes
npm run type-check

# 3. Linting passes
npm run lint

# 4. Code is formatted
npm run format

# 5. Build succeeds
npm run build

# 6. Coverage >= 80%
npm run test:coverage
```

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(node): add timeout configuration parameter

- Add timeout field to node parameters
- Default to 30 seconds
- Validate range 1-300 seconds

Closes #123
```

```
fix(validation): handle empty API responses

- Add Zod validation for API responses
- Throw clear error on malformed data
- Include response in error context

Fixes #456
```

### Pull Request Process

1. **Update Documentation**:
   - README.md (if user-facing changes)
   - CHANGELOG.md (add entry under "Unreleased")
   - Code comments and JSDoc

2. **Create Pull Request**:
   - Use a clear, descriptive title
   - Reference related issues
   - Describe what changed and why
   - Include screenshots for UI changes

3. **PR Template**:
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests added/updated
   - [ ] All tests pass
   - [ ] Manual testing completed

   ## Checklist
   - [ ] Code follows project standards
   - [ ] Self-review completed
   - [ ] Comments added for complex logic
   - [ ] Documentation updated
   - [ ] No new warnings
   - [ ] Tests provide >= 80% coverage

   ## Related Issues
   Closes #(issue number)
   ```

4. **Code Review**:
   - Address reviewer feedback promptly
   - Keep discussions focused and professional
   - Be open to suggestions

5. **After Approval**:
   - Squash commits if requested
   - We'll merge your PR
   - Delete your feature branch

## Reporting Bugs

### Before Reporting

1. **Search existing issues** - Your bug may already be reported
2. **Verify it's reproducible** - Can you consistently reproduce it?
3. **Test with latest version** - Is it fixed in the latest release?

### Bug Report Template

```markdown
**Bug Description**
Clear and concise description

**To Reproduce**
Steps to reproduce:
1. Add SecureVector node
2. Configure with...
3. Execute workflow
4. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- n8n version: [e.g., 1.15.0]
- Node version: [e.g., v1.0.0]
- Node.js version: [e.g., 18.17.0]
- OS: [e.g., Ubuntu 22.04]

**Screenshots/Logs**
If applicable

**Additional Context**
Any other relevant information
```

## Suggesting Enhancements

### Enhancement Proposal Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Problem It Solves**
What problem does this address?

**Proposed Solution**
How would this work?

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Examples, mockups, or references
```

### Feature Requests

We welcome feature requests, but please note:

- Features must align with project goals
- Consider scope and complexity
- Think about backward compatibility
- Performance and security implications

## Development Guidelines

### Adding a New Feature

1. **Discuss First**: Open an issue to discuss major features
2. **Write Spec**: Document expected behavior
3. **Write Tests**: TDD approach - tests first
4. **Implement**: Write the minimum code to pass tests
5. **Document**: Update user-facing documentation
6. **Test Manually**: Test in actual n8n instance

### Modifying Existing Code

1. **Understand Context**: Read existing code and tests
2. **Add Tests**: Add tests for new scenarios before changing code
3. **Refactor**: Make changes while keeping tests green
4. **Verify**: Run full test suite
5. **Document**: Update relevant documentation

### Working with n8n Types

```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  NodeApiError,
} from 'n8n-workflow';

// Always use n8n's provided types
// Never use 'any' for n8n interfaces
```

### Error Handling

```typescript
// Use NodeOperationError for validation/configuration errors
if (!prompt) {
  throw new NodeOperationError(
    this.getNode(),
    'Prompt is required',
    { itemIndex: i }
  );
}

// Use NodeApiError for API failures
catch (error) {
  if (error.statusCode === 401) {
    throw new NodeApiError(this.getNode(), error, {
      message: 'Invalid API key',
      description: 'Check your SecureVector credentials',
    });
  }
}
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

When you submit code changes, your submissions are understood to be under the same MIT License that covers the project. If you have concerns, please contact the maintainers.

### Contributor License Agreement

By submitting a pull request, you represent that:

1. You have the right to license your contribution to SecureVector and the community
2. You grant SecureVector and recipients a perpetual, worldwide, non-exclusive, royalty-free license
3. Your contribution is your original creation or you have rights to submit it

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community chat
- **Email**: support@securevector.io for private inquiries

## Recognition

Contributors will be acknowledged in:

- NOTICE file
- Release notes
- GitHub contributors page

Thank you for making n8n-nodes-securevector better!

---

**Last Updated**: 2025-12-26
