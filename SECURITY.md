# Security Policy

## Reporting a Vulnerability

SecureVector takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report a Security Vulnerability

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead, please report security vulnerabilities to:

**Email**: security@securevector.io

###What to Include in Your Report

Please include as much information as possible:

1. **Description**: Brief description of the vulnerability
2. **Impact**: Potential impact and attack scenario
3. **Reproduction Steps**: Detailed steps to reproduce the vulnerability
4. **Affected Versions**: Which versions are affected
5. **Suggested Fix**: If you have a suggested fix or mitigation
6. **Disclosure Timeline**: Your preferred disclosure timeline

### Our Commitment

When you report a vulnerability, we commit to:

1. **Acknowledgment**: Acknowledge receipt within 48 hours
2. **Communication**: Keep you informed of progress
3. **Timeline**: Provide an expected fix timeline within 7 days
4. **Credit**: Give you credit for the discovery (unless you prefer to remain anonymous)
5. **Disclosure**: Coordinate public disclosure with you

### Security Update Process

1. **Assessment**: We'll verify and assess the severity (Critical, High, Medium, Low)
2. **Fix Development**: Develop and test a fix
3. **Release**: Release a security patch
4. **Announcement**: Publish a security advisory on GitHub
5. **Notification**: Notify users via npm and GitHub releases

### Severity Levels

- **Critical**: Immediate threat to user security, data breaches, remote code execution
- **High**: Significant security issue, privilege escalation, authentication bypass
- **Medium**: Security issue with limited impact or requiring specific conditions
- **Low**: Minor security concerns, information disclosure

### Supported Versions

We provide security updates for:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | ✅ Yes             |
| 0.x.x   | ⚠️ Best effort     |
| < 0.1.0 | ❌ No              |

### Security Best Practices for Users

When using n8n-nodes-securevector:

1. **API Keys**:
   - Never hardcode API keys in workflows
   - Always use n8n's credential system
   - Rotate API keys regularly
   - Use environment-specific keys (dev vs prod)

2. **Workflow Security**:
   - Enable "Continue On Fail" for graceful error handling
   - Validate and sanitize all user inputs
   - Use HTTPS-only communications
   - Limit workflow permissions appropriately

3. **Updates**:
   - Keep n8n-nodes-securevector updated
   - Monitor security advisories
   - Subscribe to GitHub release notifications

4. **Audit**:
   - Regular security audits of workflows using this node
   - Review n8n audit logs
   - Monitor for unusual API usage patterns

### Known Security Considerations

#### API Key Handling
- API keys are stored encrypted in n8n's credential system
- Keys are never logged or exposed in error messages
- All API communication uses HTTPS

#### Input Validation
- All prompts are validated before transmission
- Size limits enforced (10,000 character max)
- Timeout limits prevent resource exhaustion

#### Dependency Security
- Regular npm audit scans
- Automated dependency updates via Dependabot
- No runtime dependencies beyond n8n-workflow and zod

**Known Peer Dependency Vulnerability:**
- **CVE**: GHSA-fjxv-7rqg-78g4 (form-data 4.0.0-4.0.3)
- **Source**: Transitive dependency via n8n-workflow
- **Impact**: NOT exploitable in this package (we do not use form-data directly)
- **Mitigation**: Keep n8n updated to receive patched n8n-workflow versions
- **Status**: Monitored; no action required for this package

### Responsible Disclosure

We follow a coordinated disclosure model:

1. **Private Disclosure**: Report sent to security@securevector.io
2. **Fix Development**: We develop and test a fix (1-30 days depending on severity)
3. **Patch Release**: Release security patch
4. **Public Disclosure**: Publish advisory 7 days after patch release
5. **CVE Assignment**: Request CVE if applicable

### Bug Bounty Program

We currently do not have a bug bounty program. However, we deeply appreciate security research and will:

- Publicly acknowledge contributors (with permission)
- Provide credit in security advisories
- Consider future bounty programs as the project grows

### Security Resources

- **Security Advisories**: https://github.com/Secure-Vector/n8n-nodes-securevector/security/advisories
- **Dependency Alerts**: Enabled via GitHub Dependabot
- **Code Scanning**: Automated via GitHub Actions

### Contact

For security-related questions or concerns:

- **Security Team**: security@securevector.io
- **General Support**: support@securevector.io
- **Website**: https://securevector.io/security

### Legal

By reporting a security vulnerability, you agree to:

1. Give us reasonable time to fix the issue before public disclosure
2. Not exploit the vulnerability for malicious purposes
3. Not access or modify data beyond what's necessary to demonstrate the vulnerability

We commit to not pursue legal action against security researchers who:

1. Report vulnerabilities in good faith
2. Follow this disclosure policy
3. Avoid privacy violations, data destruction, and service interruptions

---

**Last Updated**: 2025-12-26

**Version**: 1.0.0
