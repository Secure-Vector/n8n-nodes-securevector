/**
 * Type definitions for SecureVector n8n node
 * Based on data-model.md specification
 */

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export type ThreatCategory =
  | 'prompt_injection'
  | 'adversarial_attack'
  | 'model_extraction'
  | 'data_poisoning'
  | 'privacy_leak'
  | 'bias_exploitation'
  | 'model_inversion'
  | 'membership_inference'
  | 'backdoor_attack'
  | 'evasion_attack'
  | 'jailbreak_attempt'
  | 'sensitive_data_exposure'
  | 'inappropriate_content'
  | 'malicious_code_generation'
  | 'social_engineering'
  | 'misinformation_generation'
  | 'privilege_escalation';

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Transport mode — determines which SecureVector backend the node talks to.
 * `cloud`  → existing behaviour, hits scan.securevector.io with an API key.
 * `local`  → hits a SecureVector local app over loopback (default 127.0.0.1:8741),
 *            unlocks tool-audit, cost-tracking, and device-ID operations that
 *            are intentionally absent from the cloud API.
 */
export type Transport = 'cloud' | 'local';

export interface ScanRequest {
  prompt: string;
  timeout?: number;
  metadata?: {
    workflowId?: string;
    executionId?: string;
    source?: string;
  };
  // Local-app only: when true, /analyze treats the input as an LLM response
  // (applies output-leakage / PII scanning tuned for model output).
  llm_response?: boolean;
}

export interface Threat {
  category: ThreatCategory;
  severity: ThreatSeverity;
  title: string;
  description: string;
  confidence: number;
  location?: {
    start: number;
    end: number;
  };
  mitigation?: string;
}

export interface ScanResponse {
  verdict: string;
  score: number;
  threat_score: number;
  riskLevel: string;
  threat_level: string;
  confidence_score: number;
  threats: Array<{
    rule_id: string;
    rule_name: string;
    category: string;
    severity: string;
    confidence: number;
  }>;
  recommendation: string | null;
  analysis: Record<string, unknown>;
}

export interface CredentialData {
  apiKey: string;
  baseUrl?: string;
}

export interface NodeParameters {
  prompt: string;
  timeout: number;
  includeMetadata: boolean;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId: string;
}

// ---------------------------------------------------------------------------
// Local-app operations (v0.2.0+). These only apply when transport=local.
// Each maps to an endpoint on the SecureVector AI Threat Monitor app
// (FastAPI server on 127.0.0.1:8741).
// ---------------------------------------------------------------------------

// tools.checkPermission — decide if a tool call should be allowed.
// Source of truth lives on the user's machine in the app's SQLite DB,
// merged from essential + custom tool lists with user overrides applied.
export interface ToolPermissionCheckResponse {
  tool_id: string;
  function_name?: string;
  action: 'allow' | 'block' | 'log_only';
  reason: string;
  risk: string;
  effective: boolean;
}

// tools.logCall — write one row into the tamper-evident audit chain.
export interface ToolAuditRequest {
  tool_id: string;
  function_name: string;
  action: 'allow' | 'block' | 'log_only';
  reason?: string;
  risk?: string;
  args_preview?: string;
  is_essential?: boolean;
}

export interface ToolAuditResponse {
  ok: boolean;
  seq?: number;
  row_hash?: string;
}

// tools.verifyChain — walk the chain and report integrity.
export interface AuditIntegrityResponse {
  ok: boolean;
  total: number;
  tampered_at: number | null;
}

// costs.track — record one LLM call's token usage so the app can price it.
// `source` tells the node where to dig for token counts in `$json` —
// the three shipping LLM node families surface usage differently.
export type CostTrackSource = 'openai_native' | 'langchain_chain' | 'agent_execution';

export interface CostTrackRequest {
  agent_id: string;
  provider: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  input_cached_tokens?: number;
}

export interface CostTrackResponse {
  status: string;
  total_cost_usd?: number;
  pricing_known?: boolean;
}

// costs.checkBudget — ask the app whether this agent is within budget today.
export interface BudgetStatusResponse {
  agent_id: string;
  today_spend_usd: number;
  effective_budget_usd: number | null;
  over_budget: boolean;
  budget_action?: 'warn' | 'block';
}

// system.getDeviceId — stable per-machine identifier.
export interface DeviceIdResponse {
  device_id: string;
}
