/**
 * Zod validation schemas for SecureVector n8n node
 * Provides runtime type safety for API requests and responses
 * Based on data-model.md specification
 */

import { z } from 'zod';

export const RiskLevelSchema = z.enum(['safe', 'low', 'medium', 'high', 'critical']);

export const ThreatCategorySchema = z.enum([
  'prompt_injection',
  'adversarial_attack',
  'model_extraction',
  'data_poisoning',
  'privacy_leak',
  'bias_exploitation',
  'model_inversion',
  'membership_inference',
  'backdoor_attack',
  'evasion_attack',
  'jailbreak_attempt',
  'sensitive_data_exposure',
  'inappropriate_content',
  'malicious_code_generation',
  'social_engineering',
  'misinformation_generation',
  'privilege_escalation',
]);

export const ThreatSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const ThreatSchema = z.object({
  category: ThreatCategorySchema,
  severity: ThreatSeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  confidence: z.number().min(0).max(1),
  location: z
    .object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
    })
    .optional(),
  mitigation: z.string().max(500).optional(),
});

export const ScanRequestSchema = z.object({
  prompt: z
    .string()
    .min(1, 'Prompt cannot be empty')
    .max(10000, 'Prompt exceeds maximum length of 10,000 characters'),
  timeout: z.number().int().min(1).max(300).optional().default(30),
  metadata: z
    .object({
      workflowId: z.string().optional(),
      executionId: z.string().optional(),
      source: z.string().optional(),
    })
    .optional(),
});

// Actual SecureVector API response schema
export const ActualScanResponseSchema = z.object({
  verdict: z.enum(['ALLOW', 'BLOCK']),
  threat_score: z.number().min(0).max(1),
  threat_level: z.enum(['safe', 'low', 'medium', 'high', 'critical']),
  confidence_score: z.number().min(0).max(1),
  matched_rules: z.array(z.object({
    rule_id: z.string(),
    rule_name: z.string(),
    category: z.string(),
    severity: z.string(),
    confidence: z.number(),
    matched_pattern: z.string(),
    pattern_type: z.string(),
    evidence: z.any().nullable(),
  })),
  analysis: z.object({
    scan_duration_ms: z.number().optional(),
    rules_evaluated: z.number().optional(),
    rules_matched: z.number().optional(),
  }).passthrough(),
  recommendation: z.string().nullable(),
}).passthrough();

// Normalized response for n8n (transformed from ActualScanResponseSchema)
export const ScanResponseSchema = z.object({
  verdict: z.string(),
  score: z.number().min(0).max(100),
  threat_score: z.number().min(0).max(1),
  riskLevel: z.string(),
  threat_level: z.string(),
  confidence_score: z.number(),
  threats: z.array(z.object({
    rule_id: z.string(),
    rule_name: z.string(),
    category: z.string(),
    severity: z.string(),
    confidence: z.number(),
  })),
  recommendation: z.string().nullable(),
  analysis: z.record(z.unknown()),
}).passthrough();

export const CredentialDataSchema = z.object({
  apiKey: z
    .string()
    .min(32, 'API key must be at least 32 characters')
    .regex(/^(sk|sv)[_-][a-zA-Z0-9_-]+$/, 'Invalid API key format (must start with "sk_", "sk-", "sv_", or "sv-")'),
  baseUrl: z
    .string()
    .url('Invalid base URL')
    .refine((url) => {
      // Enforce HTTPS only
      return url.startsWith('https://');
    }, 'Base URL must use HTTPS protocol for security')
    .refine((url) => {
      // Domain whitelist - only allow securevector.io and subdomains
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        return hostname === 'securevector.io' || hostname.endsWith('.securevector.io');
      } catch {
        return false;
      }
    }, 'Base URL must be a securevector.io domain (e.g., https://scan.securevector.io)')
    .optional()
    .default('https://scan.securevector.io'),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  timestamp: z.string().datetime(),
  requestId: z.string().uuid(),
});
