import {
  IExecuteFunctions,
  IHttpRequestOptions,
  JsonObject,
  NodeApiError,
  NodeOperationError,
} from 'n8n-workflow';
import { validateCredentials, validateScanRequest, validateScanResponse } from './validation';
import { ScanRequest, ScanResponse } from './types';

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
 * Sleep helper for retry backoff
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Execute HTTP request with exponential backoff retry logic
 * Handles rate limiting (429) and transient errors
 */
async function executeWithRetry(
  executeFunctions: IExecuteFunctions,
  options: IHttpRequestOptions,
  maxRetries: number = 3,
): Promise<unknown> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response: unknown = await executeFunctions.helpers.httpRequestWithAuthentication.call(
        executeFunctions,
        'secureVectorApi',
        options,
      );
      return response as JsonObject;
    } catch (error: unknown) {
      lastError = error as Error;
      const err = error as { httpCode?: number; code?: string };

      // Check if this is a rate limit error (429) or transient error (502, 503, 504)
      const isRateLimitError = err.httpCode === 429;
      const isTransientError = err.httpCode === 502 || err.httpCode === 503 || err.httpCode === 504;
      const shouldRetry = (isRateLimitError || isTransientError) && attempt < maxRetries;

      if (!shouldRetry) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s... with jitter
      const baseDelay = Math.min(1000 * Math.pow(2, attempt), 10000);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      await sleep(delay);
    }
  }

  throw lastError;
}

/* eslint-disable max-lines-per-function, complexity */
export async function scanPrompt(
  this: IExecuteFunctions,
  itemIndex: number,
): Promise<ScanResponse> {
  const rawPrompt = this.getNodeParameter('prompt', itemIndex, '') as string;

  // Validate that we have a prompt to scan
  if (!rawPrompt || rawPrompt.trim() === '') {
    throw new NodeOperationError(
      this.getNode(),
      'Prompt is required but was empty or undefined',
      {
        itemIndex,
        description: 'Please provide a prompt to scan. You can use expressions like {{ $json.prompt }} to get data from previous nodes, or enter text directly.',
      },
    );
  }

  // Truncate prompt if it exceeds maximum length (10,000 chars to match llm-security-engine)
  const MAX_PROMPT_LENGTH = 10000;
  let processedPrompt = rawPrompt;
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    processedPrompt = rawPrompt.substring(0, MAX_PROMPT_LENGTH);
  }

  // Sanitize prompt to remove control characters and normalize encoding
  const prompt = sanitizePrompt(processedPrompt);

  // Validate timeout parameter
  const rawTimeout = this.getNodeParameter('timeout', itemIndex, 30) as number;
  if (!Number.isFinite(rawTimeout) || rawTimeout < 1 || rawTimeout > 300) {
    throw new NodeOperationError(
      this.getNode(),
      `Invalid timeout value: ${rawTimeout}. Must be between 1 and 300 seconds.`,
      { itemIndex },
    );
  }
  const timeout = rawTimeout;

  const includeMetadata = this.getNodeParameter('includeMetadata', itemIndex, false) as boolean;
  const blockOnThreat = this.getNodeParameter('blockOnThreat', itemIndex, false) as boolean;

  // Get user-selected blocking conditions
  const blockingConditions = this.getNodeParameter(
    'blockingConditions',
    itemIndex,
    ['verdict'],
  ) as string[];

  // Validate threat threshold parameter (only if score-based blocking is enabled)
  const rawThreshold = this.getNodeParameter('threatThreshold', itemIndex, 50) as number;
  if (blockingConditions.includes('score') && (!Number.isFinite(rawThreshold) || rawThreshold < 0 || rawThreshold > 100)) {
    throw new NodeOperationError(
      this.getNode(),
      `Invalid threat threshold: ${rawThreshold}. Must be between 0 and 100.`,
      { itemIndex },
    );
  }
  const threatThreshold = rawThreshold;

  const blockOnRiskLevels = this.getNodeParameter(
    'blockOnRiskLevels',
    itemIndex,
    ['critical', 'high'],
  ) as string[];

  // Get and validate credentials at runtime (CRITICAL SECURITY FIX)
  const credentials = await this.getCredentials('secureVectorApi');
  const validatedCredentials = validateCredentials({
    apiKey: credentials.apiKey,
    baseUrl: credentials.baseUrl || 'https://scan.securevector.io',
  });
  const baseUrl = validatedCredentials.baseUrl;

  const scanRequest: ScanRequest = {
    prompt,
    timeout,
  };

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

    // Execute request with retry logic for rate limiting and transient errors
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const response = await executeWithRetry(this, options, 3);

    // Validate the actual API response
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

    // Transform to normalized format for n8n
    const normalizedResponse: ScanResponse = {
      verdict: apiResponse.verdict,
      score: apiResponse.threat_score * 100, // Convert 0-1 to 0-100
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

    // Check if blocking mode is enabled
    if (blockOnThreat && blockingConditions.length > 0) {
      let shouldBlock = false;

      // Check each enabled blocking condition
      if (blockingConditions.includes('verdict') && apiResponse.verdict === 'BLOCK') {
        shouldBlock = true;
      }

      if (blockingConditions.includes('score') && normalizedResponse.score > threatThreshold) {
        shouldBlock = true;
      }

      if (blockingConditions.includes('riskLevel') && blockOnRiskLevels.includes(normalizedResponse.riskLevel)) {
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

    // Sanitize error message to prevent credential exposure
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
        description: 'The scan did not complete in time. Consider increasing the timeout value or try again later.',
        itemIndex,
      });
    }

    // Sanitize the entire error object before throwing
    const sanitizedError = {
      ...(typeof error === 'object' && error !== null ? error : {}),
      message: sanitizedMessage,
    } as JsonObject;

    throw new NodeApiError(this.getNode(), sanitizedError, { itemIndex });
  }
}
