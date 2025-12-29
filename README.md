# n8n-nodes-securevector

[![npm version](https://img.shields.io/npm/v/@securevector/n8n-nodes-securevector)](https://www.npmjs.com/package/@securevector/n8n-nodes-securevector)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)

**AI prompt security scanning for n8n workflows.** Detect prompt injection, jailbreak attempts, and 17+ threat categories in real-time.

> **⚠️ LEGAL DISCLAIMER**: This software is provided "AS-IS" without warranties. SecureVector makes NO guarantees about security effectiveness. Users assume ALL risk and liability. See [License](#license) for full terms.

## Quick Start

### Installation

**Via n8n Community Nodes** (Recommended):
1. Go to **Settings** → **Community Nodes** → **Install**
2. Enter: `@securevector/n8n-nodes-securevector`
3. Restart n8n

**Via npm**:
```bash
cd ~/.n8n && npm install @securevector/n8n-nodes-securevector
```

### Setup

1. **Get API key**:
   - Direct link: [https://app.securevector.io/dashboard?section=access](https://app.securevector.io/dashboard?section=access)
   - Or navigate: SecureVector App → Access Management → Create API Key
2. Add SecureVector node to workflow
3. Configure credentials (API key format: `sv_xxxxx`)

## Operation Modes

| Mode | Use Case | Behavior | Configuration | Diagram |
|------|----------|----------|---------------|---------|
| **Non-Blocking** | Analysis & logging | Returns scan results, workflow continues regardless of threat | `Block on Threat`: OFF | `Trigger → SecureVector → Next Node` |
| **Blocking** | Security gate | Stops workflow if threat detected | `Block on Threat`: ON<br>`Threshold`: 0-100<br>`Risk Levels`: Select | `Trigger → SecureVector → [STOP if threat] → Next Node` |
| **Parallel** | Real-time monitoring | Scan + LLM run simultaneously | `Block on Threat`: OFF<br>Split workflow | `Trigger ──┬→ SecureVector`<br>`          └→ LLM → Merge` |

### Mode Details

**🔓 Non-Blocking (Default)**
```
User Input → SecureVector Scan → IF Node (score > 50?)
                                      ├─ TRUE → Alert Team
                                      └─ FALSE → Send to LLM
```
**Use for**: Logging, metrics, conditional routing

---

**🔒 Blocking (Security Gate)**
```
User Input → SecureVector Scan → LLM Processing
             [THROWS ERROR IF THREAT DETECTED - WORKFLOW STOPS]
```
**Use for**: Preventing malicious prompts from reaching LLM

---

**⚡ Parallel (Async Analysis)**
```
User Input ──┬→ SecureVector Scan ──┐
             └→ LLM Processing ──────→ Merge → Results
```
**Use for**: Performance-critical workflows

## Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `prompt` | string | - | Text to scan (max 10,000 chars) |
| `timeout` | number | 30 | Scan timeout in seconds (1-300) |
| `includeMetadata` | boolean | false | Include workflow ID in request |
| `blockOnThreat` | boolean | false | Stop workflow on threat detection |
| `threatThreshold` | number | 50 | Score threshold for blocking (0-100) |
| `blockOnRiskLevels` | array | `['critical', 'high']` | Risk levels that trigger blocking |

## Output Format

```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "score": 85,
  "riskLevel": "high",
  "threats": [
    {
      "category": "prompt_injection",
      "severity": "high",
      "title": "Potential prompt injection detected",
      "description": "...",
      "confidence": 0.92
    }
  ],
  "timestamp": "2025-12-27T10:30:00.000Z",
  "metadata": {
    "processingTimeMs": 150,
    "version": "1.0.0"
  }
}
```

**Scoring**: 0 = safe, 100 = maximum threat

**Risk Levels**: `safe`, `low`, `medium`, `high`, `critical`

**17 Threat Categories**: prompt_injection, adversarial_attack, model_extraction, data_poisoning, privacy_leak, bias_exploitation, model_inversion, membership_inference, backdoor_attack, evasion_attack, jailbreak_attempt, sensitive_data_exposure, inappropriate_content, malicious_code_generation, social_engineering, misinformation_generation, privilege_escalation

## Data Privacy

**What data is sent to SecureVector API?**

This node sends **ONLY** the following data to the SecureVector API for analysis:

1. **Input data** - Any content you provide in the `prompt` parameter (text, prompts, data, or any other input you want analyzed)
2. **Metadata** (optional) - Only if `includeMetadata` is enabled:
   - Workflow ID
   - Execution ID
   - Source identifier (`n8n-workflow`)

**Why is this data sent and stored?**

- **Analysis**: Your input is analyzed for security threats and returned with a threat score
- **Your auditing**: All data you send is **persisted for your own logging and auditing purposes** - this allows you to review scan history, track which workflows triggered scans, and maintain audit trails

**What is NOT sent?**

- API keys or credentials
- Other node data or variables not explicitly provided
- Workflow configuration or logic
- Any data from other nodes in your workflow

**Important**: Anything you send for analysis will be stored by SecureVector for your auditing and logging purposes. Only send data you consent to being analyzed and stored.

**Data retention**: See [SecureVector Privacy Policy](https://securevector.io/privacypolicy) for details on how scan data is stored and retained.

## Examples

See [`examples/`](examples/) for importable n8n workflow JSON files:
- `non-blocking-analysis.json` - Conditional routing pattern
- `blocking-mode.json` - Security gate pattern
- `parallel-analysis.json` - Async scanning pattern

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Verify key format: `sv_xxxxx` at [app.securevector.io](https://app.securevector.io) |
| "Timeout" | Increase timeout parameter or check network |
| "Rate limit exceeded" | Wait 60s or upgrade plan |
| Node not appearing | Restart n8n after installation |

## Support

- **Documentation**: [docs.securevector.io](https://docs.securevector.io)
- **Issues**: [GitHub Issues](https://github.com/Secure-Vector/n8n-nodes-securevector/issues)
- **Security**: Report to security@securevector.io (see [SECURITY.md](SECURITY.md))

## Development

```bash
git clone https://github.com/Secure-Vector/n8n-nodes-securevector.git
cd n8n-nodes-securevector
npm install
npm test          # Run tests
npm run build     # Build dist/
npm link          # Link to local n8n
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Licensed under [Apache License 2.0](LICENSE).

### DISCLAIMER

**THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.**

**SecureVector makes NO representations or warranties about:**
- The accuracy, reliability, or completeness of security scans
- The detection or prevention of security threats
- The suitability for any particular purpose

**Users assume ALL risk and liability for:**
- Use of this software in production environments
- Any security breaches, data loss, or damages
- Compliance with applicable laws and regulations

**This node is a TOOL ONLY. It does not guarantee security.** Users are solely responsible for implementing comprehensive security measures.

By using this software, you acknowledge that **SecureVector shall not be liable for any claims, damages, or losses** arising from its use.

---

**Copyright © 2025 SecureVector. All rights reserved.**

## Security Notes

### Development Dependencies
`npm audit` may show a critical vulnerability in `form-data` (via `n8n-workflow`). **This does not affect the published package** because:

- `n8n-workflow` is a **peer dependency** (provided by n8n runtime, not bundled)
- Our package only bundles `zod` (no vulnerabilities)
- Our code uses **JSON requests**, not multipart/form-data
- The vulnerability would need to be fixed in n8n core, not this package

For the latest security updates, keep your n8n installation up to date.

### Reporting Security Issues
Report security issues to: security@securevector.io
