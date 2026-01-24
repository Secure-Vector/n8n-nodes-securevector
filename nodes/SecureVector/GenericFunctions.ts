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

  // Get additional fields from collection
  const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as {
    timeout?: number;
    includeMetadata?: boolean;
  };

  // Validate timeout parameter
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

  // Get blocking options from collection
  const blockingOptions = this.getNodeParameter('blockingOptions', itemIndex, {}) as {
    blockOnThreat?: boolean;
    blockingConditions?: string[];
    threatThreshold?: number;
    blockOnRiskLevels?: string[];
  };

  const blockOnThreat = blockingOptions.blockOnThreat ?? false;

  // Get user-selected blocking conditions
  const blockingConditions = blockingOptions.blockingConditions ?? ['verdict'];

  // Validate threat threshold parameter (only if score-based blocking is enabled)
  const rawThreshold = blockingOptions.threatThreshold ?? 50;
  if (blockingConditions.includes('score') && (!Number.isFinite(rawThreshold) || rawThreshold < 0 || rawThreshold > 100)) {
    throw new NodeOperationError(
      this.getNode(),
      `Invalid threat threshold: ${rawThreshold}. Must be between 0 and 100.`,
      { itemIndex },
    );
  }
  const threatThreshold = rawThreshold;

  const blockOnRiskLevels = blockingOptions.blockOnRiskLevels ?? ['critical', 'high'];

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

    // Execute request - n8n has built-in retry logic under node settings
    const response: unknown = await this.helpers.httpRequestWithAuthentication.call(
      this,
      'secureVectorApi',
      options,
    );

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
