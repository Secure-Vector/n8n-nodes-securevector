import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
  NodeOperationError,
} from 'n8n-workflow';
import {
  validateCloudCredentials,
  validateLocalBaseUrl,
  validateScanRequest,
  validateScanResponse,
  validateToolAuditRequest,
  validateToolAuditResponse,
  validatePermissionCheckResponse,
  validateAuditIntegrityResponse,
  validateCostTrackRequest,
  validateCostTrackResponse,
  validateBudgetStatusResponse,
  validateDeviceIdResponse,
} from './validation';
import {
  ScanRequest,
  ScanResponse,
  Transport,
  CostTrackSource,
  ToolPermissionCheckResponse,
  ToolAuditResponse,
  AuditIntegrityResponse,
  CostTrackResponse,
  BudgetStatusResponse,
  DeviceIdResponse,
} from './types';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Sanitize error messages to prevent credential exposure
 * Removes API keys, tokens, and other sensitive data patterns
 */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/(sk|sv)[_-][a-zA-Z0-9_-]+/g, '***REDACTED***')
    .replace(/api[_-]?key[:\s=]+[^\s]+/gi, 'apiKey: ***REDACTED***')
    .replace(/authorization[:\s=]+[^\s]+/gi, 'Authorization: ***REDACTED***')
    .replace(/x-api-key[:\s=]+[^\s]+/gi, 'X-Api-Key: ***REDACTED***')
    .replace(/bearer\s+[^\s]+/gi, 'Bearer ***REDACTED***');
}

/**
 * Sanitize and validate prompt input
 * Removes control characters and validates encoding
 */
function sanitizePrompt(prompt: string): string {
  // Remove control characters (except newline, carriage return, tab)
  // eslint-disable-next-line no-control-regex
  let sanitized = prompt.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize unicode to NFC form for consistent processing
  sanitized = sanitized.normalize('NFC');

  // Trim excessive whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Read the current transport + resolve the base URL to hit.
 *
 * Cloud:  strict validator (HTTPS, securevector.io domain) against the
 *         `secureVectorApi` credential. Unchanged from v0.1.5 behaviour.
 * Local:  read `localBaseUrl` from the node (default http://127.0.0.1:8741),
 *         loopback-only validator, no credential required.
 *
 * Returned object is enough to build every request — the auth-helper choice
 * (with vs without credential) is decided at the call site by checking
 * `transport`.
 */
async function resolveTransport(
  fn: IExecuteFunctions,
  itemIndex: number,
): Promise<{ transport: Transport; baseUrl: string }> {
  const transport = (fn.getNodeParameter('transport', itemIndex, 'cloud') as Transport) || 'cloud';

  if (transport === 'local') {
    const raw = fn.getNodeParameter(
      'localBaseUrl',
      itemIndex,
      'http://127.0.0.1:8741',
    ) as string;
    return { transport, baseUrl: validateLocalBaseUrl(raw) };
  }

  // Cloud (default) — keep the strict legacy path exactly.
  const credentials = await fn.getCredentials('secureVectorApi');
  const validated = validateCloudCredentials({
    apiKey: credentials.apiKey,
    baseUrl: credentials.baseUrl || 'https://scan.securevector.io',
  });
  return { transport, baseUrl: validated.baseUrl as string };
}

/**
 * Small wrapper around `httpRequest` / `httpRequestWithAuthentication`.
 *
 * Local requests go over vanilla `httpRequest` (no auth header).
 * Cloud requests attach the `secureVectorApi` credential so the X-Api-Key
 * header is injected automatically — matches how scanPrompt worked in v0.1.5.
 */
async function doHttp<T = unknown>(
  fn: IExecuteFunctions,
  transport: Transport,
  options: IHttpRequestOptions,
): Promise<T> {
  if (transport === 'local') {
    return (await fn.helpers.httpRequest(options)) as T;
  }
  return (await fn.helpers.httpRequestWithAuthentication.call(
    fn,
    'secureVectorApi',
    options,
  )) as T;
}

/**
 * Centralised error funnel for local-only helpers. Cloud helpers already
 * wrap in NodeApiError with sanitisation; this does the equivalent for the
 * local path where there's no API key to leak but we still want consistent
 * user-facing messages.
 */
function raiseLocalError(
  fn: IExecuteFunctions,
  err: unknown,
  itemIndex: number,
  op: string,
): never {
  const error = err as Error & { code?: string };
  const msg = error.message ? sanitizeErrorMessage(error.message) : `Unknown error in ${op}`;
  if (error.code === 'ECONNREFUSED') {
    throw new NodeApiError(
      fn.getNode(),
      { message: msg } as JsonObject,
      {
        message: `Cannot reach SecureVector local app for ${op}.`,
        description:
          'Is the SecureVector AI Threat Monitor app running on the configured port? Default is http://127.0.0.1:8741. See the node\'s README "Local App support" section.',
        itemIndex,
      },
    );
  }
  throw new NodeApiError(
    fn.getNode(),
    { ...(typeof err === 'object' && err ? err : {}), message: msg } as JsonObject,
    { itemIndex },
  );
}

// ---------------------------------------------------------------------------
// /analyze — used by both scanPrompt and scanOutput.
// ---------------------------------------------------------------------------

async function doScan(
  this: IExecuteFunctions,
  itemIndex: number,
  kind: 'input' | 'output',
): Promise<ScanResponse> {
  const rawPrompt = this.getNodeParameter('prompt', itemIndex, '') as string;

  if (!rawPrompt || rawPrompt.trim() === '') {
    throw new NodeOperationError(
      this.getNode(),
      'Prompt is required but was empty or undefined',
      {
        itemIndex,
        description:
          'Please provide text to scan. You can use expressions like {{ $json.prompt }} to get data from previous nodes, or enter text directly.',
      },
    );
  }

  const MAX_PROMPT_LENGTH = 10000;
  let processedPrompt = rawPrompt;
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    processedPrompt = rawPrompt.substring(0, MAX_PROMPT_LENGTH);
  }
  const prompt = sanitizePrompt(processedPrompt);

  const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as {
    timeout?: number;
    includeMetadata?: boolean;
  };

  const rawTimeout = additionalFields.timeout ?? 30;
  if (!Number.isFinite(rawTimeout) || rawTimeout < 1 || rawTimeout > 300) {
    throw new NodeOperationError(
      this.getNode(),
      `Invalid timeout value: ${rawTimeout}. Must be between 1 and 300 seconds.`,
      { itemIndex },
    );
  }
  const timeout = rawTimeout;
  const includeMetadata = additionalFields.includeMetadata ?? false;

  const blockingOptions = this.getNodeParameter('blockingOptions', itemIndex, {}) as {
    blockOnThreat?: boolean;
    blockingConditions?: string[];
    threatThreshold?: number;
    blockOnRiskLevels?: string[];
  };

  const blockOnThreat = blockingOptions.blockOnThreat ?? false;
  const blockingConditions = blockingOptions.blockingConditions ?? ['verdict'];
  const rawThreshold = blockingOptions.threatThreshold ?? 50;
  if (
    blockingConditions.includes('score') &&
    (!Number.isFinite(rawThreshold) || rawThreshold < 0 || rawThreshold > 100)
  ) {
    throw new NodeOperationError(
      this.getNode(),
      `Invalid threat threshold: ${rawThreshold}. Must be between 0 and 100.`,
      { itemIndex },
    );
  }
  const threatThreshold = rawThreshold;
  const blockOnRiskLevels = blockingOptions.blockOnRiskLevels ?? ['critical', 'high'];

  const { transport, baseUrl } = await resolveTransport(this, itemIndex);

  const scanRequest: ScanRequest = { prompt, timeout };
  if (kind === 'output') {
    scanRequest.llm_response = true;
  }
  if (includeMetadata) {
    const workflowId = this.getWorkflow().id;
    const executionId = this.getExecutionId();
    scanRequest.metadata = {
      workflowId: workflowId || undefined,
      executionId: executionId || undefined,
      source: 'n8n-workflow',
    };
  }

  try {
    const validatedRequest = validateScanRequest(scanRequest);

    const options: IHttpRequestOptions = {
      method: 'POST',
      url: `${baseUrl}/analyze`,
      body: validatedRequest,
      json: true,
      timeout: timeout * 1000,
    };

    const response = await doHttp<unknown>(this, transport, options);
    validateScanResponse(response);
    const apiResponse = response as {
      verdict: 'ALLOW' | 'BLOCK';
      threat_score: number;
      threat_level: string;
      confidence_score: number;
      matched_rules: Array<{
        rule_id: string;
        rule_name: string;
        category: string;
        severity: string;
        confidence: number;
        matched_pattern: string;
        pattern_type: string;
        evidence: unknown;
      }>;
      analysis: Record<string, unknown>;
      recommendation: string | null;
    };

    const normalizedResponse: ScanResponse = {
      verdict: apiResponse.verdict,
      score: apiResponse.threat_score * 100,
      threat_score: apiResponse.threat_score,
      riskLevel: apiResponse.threat_level,
      threat_level: apiResponse.threat_level,
      confidence_score: apiResponse.confidence_score,
      threats: apiResponse.matched_rules.map((rule) => ({
        rule_id: rule.rule_id,
        rule_name: rule.rule_name,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
      })),
      recommendation: apiResponse.recommendation || null,
      analysis: apiResponse.analysis,
    };

    if (blockOnThreat && blockingConditions.length > 0) {
      let shouldBlock = false;
      if (blockingConditions.includes('verdict') && apiResponse.verdict === 'BLOCK') {
        shouldBlock = true;
      }
      if (blockingConditions.includes('score') && normalizedResponse.score > threatThreshold) {
        shouldBlock = true;
      }
      if (
        blockingConditions.includes('riskLevel') &&
        blockOnRiskLevels.includes(normalizedResponse.riskLevel)
      ) {
        shouldBlock = true;
      }

      if (shouldBlock) {
        const threatSummary = normalizedResponse.threats
          .map((t) => `${t.category} (${t.severity})`)
          .join(', ');
        const recommendation = apiResponse.recommendation || 'Security threat detected';
        throw new NodeOperationError(
          this.getNode(),
          `Security threat detected: ${normalizedResponse.riskLevel} risk (score: ${normalizedResponse.score.toFixed(1)})`,
          {
            itemIndex,
            description: `${recommendation}. The prompt was flagged as ${normalizedResponse.riskLevel} risk with ${normalizedResponse.threats.length} threat(s): ${threatSummary}. Workflow blocked by security policy.`,
          },
        );
      }
    }

    return normalizedResponse;
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    // Re-throw NodeOperationError as-is — that's our deliberate block signal.
    if (err.name === 'NodeOperationError') throw err;

    const sanitizedMessage = err.message ? sanitizeErrorMessage(err.message) : 'An error occurred';

    if (err.name === 'ValidationError') {
      throw new NodeOperationError(this.getNode(), `Invalid data: ${sanitizedMessage}`, {
        itemIndex,
        description: 'The request or response data format is invalid. Please check your input.',
      });
    }
    if (err.name === 'AbortError' || err.code === 'ETIMEDOUT') {
      throw new NodeApiError(this.getNode(), error as JsonObject, {
        message: 'Scan request timed out',
        description:
          'The scan did not complete in time. Consider increasing the timeout value or try again later.',
        itemIndex,
      });
    }

    const sanitizedError = {
      ...(typeof error === 'object' && error !== null ? error : {}),
      message: sanitizedMessage,
    } as JsonObject;
    throw new NodeApiError(this.getNode(), sanitizedError, { itemIndex });
  }
}

/* eslint-disable max-lines-per-function, complexity */
export async function scanPrompt(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ScanResponse> {
  return doScan.call(this, itemIndex, 'input');
}

export async function scanOutput(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ScanResponse> {
  return doScan.call(this, itemIndex, 'output');
}

// ---------------------------------------------------------------------------
// Local-only operations — tools, costs, system.
//
// All share the same transport resolution. All fail gracefully with a clear
// "is the local app running?" message on ECONNREFUSED so a user's first-run
// experience is readable instead of a raw Node error.
// ---------------------------------------------------------------------------

/**
 * In-memory cache for the tool-permission list. Holding the full merged list
 * for a short TTL means a workflow that fires several SecureVector nodes back
 * to back only pays one round-trip. Keyed by baseUrl so two n8n instances
 * talking to different SecureVector apps stay isolated.
 *
 * We DELIBERATELY keep this tiny — no LRU, no size cap. The list is O(100)
 * tools per install; one object per baseUrl is fine.
 */
const _permCache = new Map<string, { at: number; rows: PermRow[] }>();
const PERM_CACHE_TTL_MS = 10_000;

interface PermRow {
  tool_id: string;
  risk?: string;
  effective_action?: string;
  reason?: string;
}

async function _fetchPermissionList(
  fn: IExecuteFunctions,
  baseUrl: string,
  itemIndex: number,
): Promise<PermRow[]> {
  const cached = _permCache.get(baseUrl);
  const now = Date.now();
  if (cached && now - cached.at < PERM_CACHE_TTL_MS) {
    return cached.rows;
  }

  try {
    // Both calls in parallel — the local app handles them independently.
    const [essential, custom] = await Promise.all([
      fn.helpers.httpRequest({
        method: 'GET',
        url: `${baseUrl}/api/tool-permissions/essential`,
        json: true,
      }) as Promise<{ tools?: PermRow[] }>,
      fn.helpers.httpRequest({
        method: 'GET',
        url: `${baseUrl}/api/tool-permissions/custom`,
        json: true,
      }) as Promise<{ tools?: PermRow[] }>,
    ]);

    const rows: PermRow[] = [
      ...((essential.tools ?? [])),
      ...((custom.tools ?? [])),
    ];
    _permCache.set(baseUrl, { at: now, rows });
    return rows;
  } catch (error) {
    raiseLocalError(fn, error, itemIndex, 'tools.checkPermission');
  }
}

export async function checkToolPermission(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ToolPermissionCheckResponse> {
  const toolId = (this.getNodeParameter('tool_id', itemIndex, '') as string).trim();
  const functionName = (this.getNodeParameter('function_name', itemIndex, '') as string).trim();

  if (!toolId) {
    throw new NodeOperationError(this.getNode(), 'tool_id is required', {
      itemIndex,
      description: 'Pass the SecureVector tool_id (e.g. "Gmail.send") that the agent is trying to invoke.',
    });
  }

  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'tools.checkPermission is only available with Transport=Local App',
      { itemIndex },
    );
  }

  const rows = await _fetchPermissionList(this, baseUrl, itemIndex);
  const match = rows.find((r) => r.tool_id === toolId);

  // No match → treat as log_only effective=false so a caller doesn't
  // block unknown tools by default. Operator can tighten this via the app UI.
  if (!match) {
    return validatePermissionCheckResponse({
      tool_id: toolId,
      function_name: functionName || undefined,
      action: 'log_only',
      reason: 'Tool not registered with SecureVector; default policy applied.',
      risk: 'unknown',
      effective: false,
    });
  }

  return validatePermissionCheckResponse({
    tool_id: match.tool_id,
    function_name: functionName || undefined,
    action: match.effective_action ?? 'allow',
    reason: match.reason ?? '',
    risk: match.risk ?? '',
    effective: true,
  });
}

export async function logToolCall(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ToolAuditResponse> {
  const raw = {
    tool_id: this.getNodeParameter('tool_id', itemIndex, '') as string,
    function_name: this.getNodeParameter('function_name', itemIndex, '') as string,
    action: this.getNodeParameter('action', itemIndex, 'allow') as string,
    reason: this.getNodeParameter('reason', itemIndex, '') as string,
    risk: this.getNodeParameter('risk', itemIndex, '') as string,
    args_preview: sanitizePrompt(
      (this.getNodeParameter('args_preview', itemIndex, '') as string) || '',
    ),
    is_essential: this.getNodeParameter('is_essential', itemIndex, false) as boolean,
  };

  const body = validateToolAuditRequest(raw);
  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'tools.logCall is only available with Transport=Local App',
      { itemIndex },
    );
  }

  try {
    const resp = (await this.helpers.httpRequest({
      method: 'POST',
      url: `${baseUrl}/api/tool-permissions/call-audit`,
      body,
      json: true,
    })) as unknown;
    validateToolAuditResponse(resp);
    return resp as ToolAuditResponse;
  } catch (error) {
    raiseLocalError(this, error, itemIndex, 'tools.logCall');
  }
}

export async function verifyAuditChain(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<AuditIntegrityResponse> {
  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'tools.verifyChain is only available with Transport=Local App',
      { itemIndex },
    );
  }
  try {
    const resp = (await this.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrl}/api/tool-permissions/call-audit/integrity`,
      json: true,
    })) as unknown;
    return validateAuditIntegrityResponse(resp);
  } catch (error) {
    raiseLocalError(this, error, itemIndex, 'tools.verifyChain');
  }
}

// ---------------------------------------------------------------------------
// costs.track — token-count extraction + forward to the local app.
//
// Reality check (see plan): the AI Agent node does NOT expose token usage
// in its output. We need three source modes because token paths differ
// between the standalone OpenAI node, the LangChain Chat Model sub-node,
// and the AI Agent (which requires a `Get Execution` API follow-up).
// ---------------------------------------------------------------------------

type TokenPair = { input_tokens: number; output_tokens: number; input_cached_tokens?: number };

// For `openai_native` we expose token counts as individual node params so
// the user writes expressions like `={{ $json.usage.prompt_tokens }}` in the
// UI. We read them directly as numbers — no helper needed. This path is
// kept simple because the OpenAI native node's shape is stable.
// For LangChain we have to dig into a nested response, hence the helper:

function extractTokensFromLangChain(json: Record<string, unknown> | undefined): TokenPair {
  // $json.response.generations[0][0].generationInfo.tokenUsage
  const response = json?.response as
    | { generations?: Array<Array<{ generationInfo?: { tokenUsage?: Record<string, number> } }>> }
    | undefined;
  const tu = response?.generations?.[0]?.[0]?.generationInfo?.tokenUsage;
  return {
    input_tokens: typeof tu?.promptTokens === 'number' ? tu.promptTokens : 0,
    output_tokens: typeof tu?.completionTokens === 'number' ? tu.completionTokens : 0,
  };
}

export async function trackCost(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<CostTrackResponse> {
  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'costs.track is only available with Transport=Local App',
      { itemIndex },
    );
  }

  const source = this.getNodeParameter(
    'source',
    itemIndex,
    'openai_native',
  ) as CostTrackSource;

  const agentId = (this.getNodeParameter('agent_id', itemIndex, '') as string).trim() || 'n8n-workflow';
  const provider = (this.getNodeParameter('provider', itemIndex, 'openai') as string).trim();

  let modelId = '';
  let tokens: TokenPair = { input_tokens: 0, output_tokens: 0 };

  if (source === 'openai_native') {
    // Default expressions point at the OpenAI "Message a Model" node output.
    const inputExpr = this.getNodeParameter('input_tokens', itemIndex, 0);
    const outputExpr = this.getNodeParameter('output_tokens', itemIndex, 0);
    const modelExpr = this.getNodeParameter('model_id', itemIndex, '') as string;

    tokens = {
      input_tokens: Number(inputExpr) || 0,
      output_tokens: Number(outputExpr) || 0,
    };
    modelId = modelExpr || 'unknown';
  } else if (source === 'langchain_chain') {
    // Helper parses the LangChain nested path from a raw $json blob the user hands us.
    const rawJson = this.getNodeParameter('langchain_json', itemIndex, {}) as
      | Record<string, unknown>
      | undefined;
    tokens = extractTokensFromLangChain(rawJson);
    const modelExpr = this.getNodeParameter('model_id', itemIndex, '') as string;
    modelId = modelExpr || 'unknown';
  } else if (source === 'agent_execution') {
    // Fallback for the AI Agent node (which doesn't expose tokens in $json).
    // Fetch the execution record and pull tokenUsage out of runData.
    const executionId = (this.getNodeParameter('executionId', itemIndex, '') as string).trim();
    if (!executionId) {
      throw new NodeOperationError(
        this.getNode(),
        'executionId is required when source=agent_execution',
        {
          itemIndex,
          description:
            'Set this to {{$execution.id}} on a node placed after the AI Agent. The node will call the n8n `Get Execution` API to retrieve tokenUsage from the Agent\'s Chat Model sub-node.',
        },
      );
    }

    // Fetching from the current n8n instance — user must have N8N_API_KEY
    // configured OR use the instance's internal credential. For simplicity
    // we let the user wire an HTTP Request node upstream if their n8n is
    // locked down. For the common self-host case, this direct call works.
    //
    // SECURITY: n8nBase is loopback-only. The API key (if set) is sent as
    // X-N8N-API-KEY; without this guard, an attacker editing the workflow
    // JSON could point this at a URL they control and harvest the key.
    // For remote n8n instances, use an HTTP Request node upstream with
    // its own authenticated credential.
    const n8nBase =
      (this.getNodeParameter('n8nBaseUrl', itemIndex, 'http://127.0.0.1:5678') as string) ||
      'http://127.0.0.1:5678';
    const n8nApiKey = (this.getNodeParameter('n8nApiKey', itemIndex, '') as string) || '';

    let n8nBaseValidated: string;
    try {
      n8nBaseValidated = validateLocalBaseUrl(n8nBase);
    } catch (e) {
      throw new NodeOperationError(
        this.getNode(),
        `n8n Base URL rejected: ${(e as Error).message}`,
        {
          itemIndex,
          description:
            'For security, the n8n instance URL must be loopback (127.0.0.1 or localhost). For remote n8n instances, use an HTTP Request node upstream with its own credential.',
        },
      );
    }

    try {
      const exec = (await this.helpers.httpRequest({
        method: 'GET',
        url: `${n8nBaseValidated}/api/v1/executions/${executionId}?includeData=true`,
        json: true,
        headers: n8nApiKey ? { 'X-N8N-API-KEY': n8nApiKey } : undefined,
      })) as {
        data?: { resultData?: { runData?: Record<string, Array<{ data?: { main?: unknown[][] } }>> } };
      };

      const runData = exec.data?.resultData?.runData ?? {};
      let input = 0;
      let output = 0;
      for (const key of Object.keys(runData)) {
        const runs = runData[key] || [];
        for (const run of runs) {
          const first = run?.data?.main?.[0]?.[0] as
            | { json?: Record<string, unknown> }
            | undefined;
          const extracted = extractTokensFromLangChain(first?.json);
          input += extracted.input_tokens;
          output += extracted.output_tokens;
        }
      }
      tokens = { input_tokens: input, output_tokens: output };
    } catch (error) {
      raiseLocalError(this, error, itemIndex, 'costs.track (agent_execution)');
    }

    const modelExpr = this.getNodeParameter('model_id', itemIndex, '') as string;
    modelId = modelExpr || 'unknown';
  }

  const body = validateCostTrackRequest({
    agent_id: agentId,
    provider,
    model_id: modelId,
    input_tokens: tokens.input_tokens,
    output_tokens: tokens.output_tokens,
    input_cached_tokens: tokens.input_cached_tokens,
  });

  try {
    const resp = (await this.helpers.httpRequest({
      method: 'POST',
      url: `${baseUrl}/api/costs/track`,
      body,
      json: true,
    })) as unknown;
    return validateCostTrackResponse(resp);
  } catch (error) {
    raiseLocalError(this, error, itemIndex, 'costs.track');
  }
}

export async function checkBudgetStatus(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<BudgetStatusResponse> {
  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'costs.checkBudget is only available with Transport=Local App',
      { itemIndex },
    );
  }
  const agentId = (this.getNodeParameter('agent_id', itemIndex, 'n8n-workflow') as string).trim();
  if (!agentId) {
    throw new NodeOperationError(this.getNode(), 'agent_id is required', { itemIndex });
  }

  try {
    const resp = (await this.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrl}/api/costs/budget-status?agent_id=${encodeURIComponent(agentId)}`,
      json: true,
    })) as unknown;
    return validateBudgetStatusResponse(resp);
  } catch (error) {
    raiseLocalError(this, error, itemIndex, 'costs.checkBudget');
  }
}

export async function getDeviceId(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<DeviceIdResponse> {
  const { transport, baseUrl } = await resolveTransport(this, itemIndex);
  if (transport !== 'local') {
    throw new NodeOperationError(
      this.getNode(),
      'system.getDeviceId is only available with Transport=Local App',
      { itemIndex },
    );
  }
  try {
    const resp = (await this.helpers.httpRequest({
      method: 'GET',
      url: `${baseUrl}/api/system/device-id`,
      json: true,
    })) as unknown;
    return validateDeviceIdResponse(resp);
  } catch (error) {
    raiseLocalError(this, error, itemIndex, 'system.getDeviceId');
  }
}
