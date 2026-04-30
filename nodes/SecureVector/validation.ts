/**
 * Manual validation functions replacing Zod schemas
 * Required for n8n verified community nodes (no runtime dependencies allowed)
 */

import {
  CredentialData,
  ScanRequest,
  ToolAuditRequest,
  ToolPermissionCheckResponse,
  AuditIntegrityResponse,
  CostTrackRequest,
  CostTrackResponse,
  BudgetStatusResponse,
  DeviceIdResponse,
} from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate cloud-mode credentials.
 *
 * Unchanged behaviour from v0.1.5: API key must start with sk_/sv_, base URL
 * must be HTTPS on a securevector.io domain. This is the strict path that
 * the n8n community-node verification process accepted.
 */
export function validateCloudCredentials(data: unknown): CredentialData {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Credentials must be an object');
  }

  const creds = data as Record<string, unknown>;

  // Validate apiKey
  if (typeof creds.apiKey !== 'string') {
    throw new ValidationError('API key must be a string');
  }

  if (creds.apiKey.length < 32) {
    throw new ValidationError('API key must be at least 32 characters');
  }

  if (!/^(sk|sv)[_-][a-zA-Z0-9_-]+$/.test(creds.apiKey)) {
    throw new ValidationError(
      'Invalid API key format (must start with "sk_", "sk-", "sv_", or "sv-")',
    );
  }

  // Validate baseUrl (optional)
  let baseUrl = 'https://scan.securevector.io';
  if (creds.baseUrl !== undefined) {
    if (typeof creds.baseUrl !== 'string') {
      throw new ValidationError('Base URL must be a string');
    }

    // Check if valid URL
    try {
      new URL(creds.baseUrl);
    } catch {
      throw new ValidationError('Invalid base URL');
    }

    if (!creds.baseUrl.startsWith('https://')) {
      throw new ValidationError('Base URL must use HTTPS protocol for security');
    }

    // Domain whitelist
    try {
      const urlObj = new URL(creds.baseUrl);
      const hostname = urlObj.hostname.toLowerCase();
      if (hostname !== 'securevector.io' && !hostname.endsWith('.securevector.io')) {
        throw new ValidationError(
          'Base URL must be a securevector.io domain (e.g., https://scan.securevector.io)',
        );
      }
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError('Invalid base URL format');
    }

    baseUrl = creds.baseUrl;
  }

  return {
    apiKey: creds.apiKey,
    baseUrl,
  };
}

/**
 * Back-compat alias. Keep the old exported name so anything that imported
 * `validateCredentials` in v0.1.5 still type-checks.
 */
export const validateCredentials = validateCloudCredentials;

/**
 * Validate a user-supplied local-app base URL.
 *
 * Loopback only. Only `http://127.0.0.1:<port>` or `http://localhost:<port>`
 * are accepted — no other host, no HTTPS required (cert on a loopback address
 * would be nonsensical). Anything else is rejected. This keeps the surface
 * small enough that the n8n verification team won't re-raise the domain
 * whitelist concern that drove the cloud validator.
 */
export function validateLocalBaseUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new ValidationError('Local Base URL must be a non-empty string');
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError(
      'Local Base URL is not a valid URL (expected http://127.0.0.1:8741 or similar)',
    );
  }

  if (url.protocol !== 'http:') {
    throw new ValidationError(
      'Local Base URL must use http:// (loopback only — HTTPS on 127.0.0.1 is unsupported)',
    );
  }

  const host = url.hostname.toLowerCase();
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new ValidationError(
      'Local Base URL must point at 127.0.0.1 or localhost. ' +
        'Remote SecureVector installs are not supported via this node; use transport=cloud instead.',
    );
  }

  // Trim trailing slash so callers can safely do `${base}/analyze`.
  return raw.replace(/\/$/, '');
}

/**
 * Validate scan request
 */
export function validateScanRequest(data: unknown): ScanRequest {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Scan request must be an object');
  }

  const req = data as Record<string, unknown>;

  // Validate prompt
  if (typeof req.prompt !== 'string') {
    throw new ValidationError('Prompt must be a string');
  }

  if (req.prompt.length === 0) {
    throw new ValidationError('Prompt cannot be empty');
  }

  if (req.prompt.length > 10000) {
    throw new ValidationError('Prompt exceeds maximum length of 10,000 characters');
  }

  // Validate timeout (optional)
  let timeout = 30;
  if (req.timeout !== undefined) {
    if (typeof req.timeout !== 'number' || !Number.isInteger(req.timeout)) {
      throw new ValidationError('Timeout must be an integer');
    }

    if (req.timeout < 1 || req.timeout > 300) {
      throw new ValidationError('Timeout must be between 1 and 300 seconds');
    }

    timeout = req.timeout;
  }

  // Validate metadata (optional)
  let metadata: ScanRequest['metadata'] | undefined;
  if (req.metadata !== undefined) {
    if (!req.metadata || typeof req.metadata !== 'object') {
      throw new ValidationError('Metadata must be an object');
    }

    const meta = req.metadata as Record<string, unknown>;

    metadata = {
      workflowId: typeof meta.workflowId === 'string' ? meta.workflowId : undefined,
      executionId: typeof meta.executionId === 'string' ? meta.executionId : undefined,
      source: typeof meta.source === 'string' ? meta.source : undefined,
    };
  }

  // Validate llm_response flag (optional, local only)
  const llm_response =
    typeof req.llm_response === 'boolean' ? req.llm_response : undefined;

  return {
    prompt: req.prompt,
    timeout,
    metadata,
    llm_response,
  };
}

/**
 * Validate API response
 */
export function validateScanResponse(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Scan response must be an object');
  }

  const resp = data as Record<string, unknown>;

  // Validate verdict
  if (typeof resp.verdict !== 'string' || !['ALLOW', 'BLOCK'].includes(resp.verdict)) {
    throw new ValidationError('Invalid verdict (must be ALLOW or BLOCK)');
  }

  // Validate threat_score
  if (
    typeof resp.threat_score !== 'number' ||
    resp.threat_score < 0 ||
    resp.threat_score > 1
  ) {
    throw new ValidationError('Invalid threat_score (must be between 0 and 1)');
  }

  // Validate threat_level
  const validThreatLevels = ['safe', 'low', 'medium', 'high', 'critical'];
  if (typeof resp.threat_level !== 'string' || !validThreatLevels.includes(resp.threat_level)) {
    throw new ValidationError('Invalid threat_level');
  }

  // Validate confidence_score
  if (
    typeof resp.confidence_score !== 'number' ||
    resp.confidence_score < 0 ||
    resp.confidence_score > 1
  ) {
    throw new ValidationError('Invalid confidence_score (must be between 0 and 1)');
  }

  // Validate matched_rules (must be an array)
  if (!Array.isArray(resp.matched_rules)) {
    throw new ValidationError('matched_rules must be an array');
  }

  // Validate recommendation (can be null or string)
  if (resp.recommendation !== null && typeof resp.recommendation !== 'string') {
    throw new ValidationError('recommendation must be a string or null');
  }

  // Validate analysis (must be an object)
  if (!resp.analysis || typeof resp.analysis !== 'object') {
    throw new ValidationError('analysis must be an object');
  }
}

// ---------------------------------------------------------------------------
// Local-app request/response validators.
//
// These are intentionally permissive on optional fields (the local app can
// add new fields over time without breaking the node) but strict on the
// shape the node's code relies on.
// ---------------------------------------------------------------------------

export function validateToolAuditRequest(data: unknown): ToolAuditRequest {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Tool audit request must be an object');
  }
  const req = data as Record<string, unknown>;

  if (typeof req.tool_id !== 'string' || req.tool_id.length === 0) {
    throw new ValidationError('tool_id must be a non-empty string');
  }
  if (typeof req.function_name !== 'string') {
    throw new ValidationError('function_name must be a string');
  }
  if (
    typeof req.action !== 'string' ||
    !['allow', 'block', 'log_only'].includes(req.action)
  ) {
    throw new ValidationError('action must be one of: allow, block, log_only');
  }

  return {
    tool_id: req.tool_id,
    function_name: req.function_name,
    action: req.action as 'allow' | 'block' | 'log_only',
    reason: typeof req.reason === 'string' ? req.reason : undefined,
    risk: typeof req.risk === 'string' ? req.risk : undefined,
    args_preview: typeof req.args_preview === 'string' ? req.args_preview : undefined,
    is_essential: typeof req.is_essential === 'boolean' ? req.is_essential : undefined,
  };
}

export function validateToolAuditResponse(data: unknown): void {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Tool audit response must be an object');
  }
  const resp = data as Record<string, unknown>;
  if (typeof resp.ok !== 'boolean') {
    throw new ValidationError('audit response missing ok boolean');
  }
}

export function validatePermissionCheckResponse(
  data: unknown,
): ToolPermissionCheckResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Permission check response must be an object');
  }
  const resp = data as Record<string, unknown>;
  if (
    typeof resp.action !== 'string' ||
    !['allow', 'block', 'log_only'].includes(resp.action)
  ) {
    throw new ValidationError(
      'Invalid permission action (must be allow/block/log_only)',
    );
  }
  return {
    tool_id: typeof resp.tool_id === 'string' ? resp.tool_id : '',
    function_name:
      typeof resp.function_name === 'string' ? resp.function_name : undefined,
    action: resp.action as 'allow' | 'block' | 'log_only',
    reason: typeof resp.reason === 'string' ? resp.reason : '',
    risk: typeof resp.risk === 'string' ? resp.risk : '',
    effective: typeof resp.effective === 'boolean' ? resp.effective : true,
  };
}

export function validateAuditIntegrityResponse(
  data: unknown,
): AuditIntegrityResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Audit integrity response must be an object');
  }
  const resp = data as Record<string, unknown>;
  if (typeof resp.ok !== 'boolean') {
    throw new ValidationError('integrity response missing ok boolean');
  }
  return {
    ok: resp.ok,
    total: typeof resp.total === 'number' ? resp.total : 0,
    tampered_at:
      typeof resp.tampered_at === 'number' ? resp.tampered_at : null,
  };
}

export function validateCostTrackRequest(data: unknown): CostTrackRequest {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Cost track request must be an object');
  }
  const req = data as Record<string, unknown>;

  if (typeof req.agent_id !== 'string' || req.agent_id.length === 0) {
    throw new ValidationError('agent_id must be a non-empty string');
  }
  if (typeof req.provider !== 'string' || req.provider.length === 0) {
    throw new ValidationError('provider must be a non-empty string');
  }
  if (typeof req.model_id !== 'string' || req.model_id.length === 0) {
    throw new ValidationError('model_id must be a non-empty string');
  }

  // Token counts: allow 0, reject negatives, reject non-integers.
  const n = (name: string, v: unknown): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || !Number.isInteger(v)) {
      throw new ValidationError(`${name} must be a non-negative integer`);
    }
    return v;
  };

  return {
    agent_id: req.agent_id,
    provider: req.provider,
    model_id: req.model_id,
    input_tokens: n('input_tokens', req.input_tokens),
    output_tokens: n('output_tokens', req.output_tokens),
    input_cached_tokens:
      req.input_cached_tokens !== undefined
        ? n('input_cached_tokens', req.input_cached_tokens)
        : undefined,
  };
}

export function validateCostTrackResponse(data: unknown): CostTrackResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Cost track response must be an object');
  }
  const resp = data as Record<string, unknown>;
  return {
    status: typeof resp.status === 'string' ? resp.status : 'ok',
    total_cost_usd:
      typeof resp.total_cost_usd === 'number' ? resp.total_cost_usd : undefined,
    pricing_known:
      typeof resp.pricing_known === 'boolean' ? resp.pricing_known : undefined,
  };
}

export function validateBudgetStatusResponse(
  data: unknown,
): BudgetStatusResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Budget status response must be an object');
  }
  const resp = data as Record<string, unknown>;
  return {
    agent_id: typeof resp.agent_id === 'string' ? resp.agent_id : '',
    today_spend_usd:
      typeof resp.today_spend_usd === 'number' ? resp.today_spend_usd : 0,
    effective_budget_usd:
      typeof resp.effective_budget_usd === 'number'
        ? resp.effective_budget_usd
        : null,
    over_budget:
      typeof resp.over_budget === 'boolean' ? resp.over_budget : false,
    budget_action:
      resp.budget_action === 'warn' || resp.budget_action === 'block'
        ? resp.budget_action
        : undefined,
  };
}

export function validateDeviceIdResponse(data: unknown): DeviceIdResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Device ID response must be an object');
  }
  const resp = data as Record<string, unknown>;
  if (typeof resp.device_id !== 'string' || resp.device_id.length === 0) {
    throw new ValidationError('device_id must be a non-empty string');
  }
  return { device_id: resp.device_id };
}
