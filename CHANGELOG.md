# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-12-27

### Added

**Core Features**:
- SecureVector n8n community node for real-time AI prompt security scanning
- Integration with scan.securevector.io API
- Support for 17 comprehensive threat categories (prompt injection, adversarial attacks, model extraction, data poisoning, privacy leaks, bias exploitation, model inversion, membership inference, backdoor attacks, evasion attacks, jailbreak attempts, sensitive data exposure, inappropriate content, malicious code generation, social engineering, misinformation generation, privilege escalation)
- Threat scoring system (0-100 scale: 0 = safe, 100 = maximum threat)
- Risk level classification (safe, low, medium, high, critical)

**Security Modes**:
- **Non-Blocking Mode** (default): Returns security analysis without stopping workflow
- **Blocking Mode**: Automatically stops workflow when threats exceed configurable thresholds
- Configurable threat score threshold (0-100)
- Configurable risk level blocking (select which risk levels trigger workflow failure)

**Authentication & Credentials**:
- Secure API key management via n8n credential system
- Bearer token authentication
- Credential verification endpoint (/auth/verify)
- Support for custom base URLs (testing/on-premise deployments)

**Node Configuration**:
- Prompt input field (multi-line, up to 10,000 characters)
- Configurable timeout (1-300 seconds, default 30)
- Optional workflow metadata inclusion (workflow ID, execution ID)
- Block on threat toggle
- Threat score threshold selector
- Multi-select risk level blocking

**Developer Experience**:
- TypeScript strict mode with 100% type safety
- Zod runtime validation for API requests and responses
- Comprehensive error handling with descriptive messages
- 65 unit and integration tests with 100% coverage on schemas
- TDD approach with tests written before implementation

**CI/CD & Automation**:
- GitHub Actions CI workflow (type-check, lint, test, build on Node 18.x & 20.x)
- Automated npm publishing on GitHub releases
- Daily security scans with npm audit
- Dependency review on pull requests
- Dependabot for automated dependency updates

**Documentation & Examples**:
- Comprehensive README with installation and usage guides
- 3 example workflow JSON files:
  - Non-blocking analysis with conditional routing
  - Blocking mode (security gate)
  - Parallel analysis (scan + LLM simultaneously)
- API documentation links
- Troubleshooting guide

**Code Quality**:
- ESLint configuration enforcing:
  - Max 50 lines per function
  - Max 300 lines per file
  - Max cyclomatic complexity of 10
  - No explicit `any` types without justification
  - Explicit return types for all functions
- Prettier code formatting
- MIT license with full legal compliance
- SECURITY.md for responsible vulnerability disclosure
- CONTRIBUTING.md with development guidelines

### Technical Details
- Built with TypeScript 5.9+
- Compatible with n8n 1.0+
- Uses Zod 3.22+ for validation
- Jest 29.7+ for testing
- Follows n8n community node best practices
- Post-build verification script
- Proper dist/ structure for npm distribution
