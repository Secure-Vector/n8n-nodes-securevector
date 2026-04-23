# n8n-nodes-securevector

[![npm version](https://img.shields.io/npm/v/@securevector/n8n-nodes-securevector)](https://www.npmjs.com/package/@securevector/n8n-nodes-securevector)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

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

The node supports **two transports**, chosen per-node via the `Transport` field:

- **Cloud** (default) — hits `scan.securevector.io`. Requires an API key. Only the Scan operations are available. Unchanged from v0.1.5.
- **Local App** — hits a SecureVector AI Threat Monitor app running on this machine (default `http://127.0.0.1:8741`). No API key. Unlocks tool-audit, cost tracking, budget checks, and device ID operations.

**Cloud setup:**
1. **Get API key**:
   - Direct link: [https://app.securevector.io/dashboard?section=access](https://app.securevector.io/dashboard?section=access)
   - Or navigate: SecureVector App → Access Management → Create API Key
2. Add SecureVector node to workflow, leave Transport = Cloud.
3. Configure credentials (API key format: `sv_xxxxx`).

**Local App setup:**
1. Install and run the [SecureVector AI Threat Monitor](https://github.com/Secure-Vector/securevector-ai-threat-monitor) desktop app — its API server listens on `127.0.0.1:8741`.
2. Add SecureVector node to workflow, set Transport = **Local App**. No credential needed.
3. Leave `Local Base URL` at default (`http://127.0.0.1:8741`) unless you've changed the app's port.

> The SecureVector app also includes a multi-provider LLM proxy on port 8742. **This n8n node does not use the proxy.** Only the API server on 8741 is required for n8n integration.

## Local App — v0.2.0 operations

All operations below are **local-only** — they require Transport = Local App. The operations below **are not available via the cloud API** and never will be, because each depends on machine-local state (hash chain, per-user cost history, device identity).

| Operation | Endpoint | What it does |
|---|---|---|
| **Prompt → Scan Prompt** | `POST /analyze` | Same as cloud — scan a user prompt. |
| **Prompt → Scan Output** | `POST /analyze` (llm_response=true) | Scan an LLM response for PII / secret / leakage. |
| **Tools → Check Permission** | `GET /api/tool-permissions/essential` + `/custom` | Ask the app whether a tool call is allowed, blocked, or log-only. |
| **Tools → Log Call** | `POST /api/tool-permissions/call-audit` | Append a tamper-evident audit row. |
| **Tools → Verify Chain** | `GET /api/tool-permissions/call-audit/integrity` | Walk the hash chain, return `{ok, total, tampered_at}`. |
| **Costs → Check Budget** | `GET /api/costs/budget-status` | Today's spend vs configured budget. |
| **Costs → Track** | `POST /api/costs/track` | Record one LLM call's token usage. |
| **System → Get Device ID** | `GET /api/system/device-id` | Stable per-machine identifier (for fleet attribution). |

### Canonical workflow patterns

**Static LLM workflow — cost-gated content generation:**

```
[Schedule hourly]
  → [SV Check Budget, agent_id=content-bot]
    → IF over_budget = true → [Slack alert] → stop
    → else                  → [OpenAI Message-a-Model, Simplify Output: OFF]
                               → [SV Track Cost, source=openai_native,
                                     input_tokens = {{$json.usage.prompt_tokens}},
                                     output_tokens = {{$json.usage.completion_tokens}}]
                               → [Publish to CMS]
```

**Static tool-gating — customer-support chatbot with injection protection:**

```
[Webhook]
  → [SV Scan Prompt, Block on Threat: ON]
    → allow → [OpenAI] → [SV Scan Output, Block on Threat: ON]
                           → allow → [Respond to Webhook]
                           → block → [Respond with fallback] + [SV Log Call action=block]
    → block → [Respond with polite refusal]
```

**AI Agent tool-gating — see SecureVectorPolicyTool below.**

### Token paths vary by upstream LLM node

The SecureVector app never counts tokens itself — it reads what the provider already returned. The `source` dropdown on `Costs → Track` tells the node where to read from:

| Upstream node | Source | Reads from |
|---|---|---|
| OpenAI "Message a Model" (core) | `openai_native` | `$json.usage.prompt_tokens` / `completion_tokens` (Simplify Output OFF) |
| LangChain Chat Model attached to a Basic LLM Chain | `langchain_chain` | `$json.response.generations[0][0].generationInfo.tokenUsage.{promptTokens, completionTokens}` |
| AI Agent (Tools Agent) | `agent_execution` | `Get Execution` API fallback — the AI Agent node does not expose tokens in `$json` ([long-standing n8n issue](https://community.n8n.io/t/retrieve-llm-token-usage-in-ai-agents/68714)) |

### SecureVectorPolicyTool — gating AI Agent tools

A second node class ships in this package: **SecureVector Policy Tool**. It's a **tool sub-node** (not an action node) that attaches to an AI Agent like any other tool. It wraps a user-supplied sub-workflow with a built-in SecureVector policy check:

```
Main workflow:
  [Trigger] → [AI Agent (Tools Agent)]
                ← Chat Model                    (OpenAI / Anthropic sub-node)
                ← Memory                        (Window Buffer)
                ← SecureVector Policy Tool      (target=Gmail.send,
                                                 real workflow id=1234)
                ← SecureVector Policy Tool      (target=HTTP.request, …)

Workflow 1234 ("real Gmail send"):
  [Execute Workflow trigger with args] → [Gmail Send node]
```

When the AI Agent's LLM picks the `secure_gmail_send` tool, the Policy Tool internally:

1. Calls `/api/tool-permissions/essential` + `/custom` and looks up the SecureVector tool_id.
2. If `action=allow` or `log_only`, invokes the real workflow with the LLM's args.
3. If `action=block`, returns `{blocked: true, reason}` to the Agent — the real workflow never runs.
4. Either way, writes an audit row to the tamper-evident chain.

**Why this pattern:** the n8n AI Agent has no native pre-tool hook and prompt-engineering "always call checkPermission first" is unreliable (LLMs skip long instructions). Wrapping each sensitive tool in a sub-workflow means the LLM physically cannot invoke the real Gmail Send node — enforcement is runtime, not advisory.

**Tool description for the LLM:** the `Tool Description` field on the Policy Tool is what the LLM reads as the tool spec. Write it imperative + name the real target + mention the block branch:

> *"Send an email via Gmail. Returns `{blocked: true, reason}` when SecureVector policy denies the call."*

so the agent handles block gracefully.

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
| `prompt` | string | - | Text to scan (max 10,000 chars, truncated if longer) |
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

Licensed under [MIT License](LICENSE).

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
