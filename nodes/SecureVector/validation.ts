/**
 * Manual validation functions replacing Zod schemas
 * Required for n8n verified community nodes (no runtime dependencies allowed)
 */

import { CredentialData, ScanRequest } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate API credentials
 */
export function validateCredentials(data: unknown): CredentialData {
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

  return {
    prompt: req.prompt,
    timeout,
    metadata,
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
