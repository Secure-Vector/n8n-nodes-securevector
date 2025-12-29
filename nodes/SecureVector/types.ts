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

export interface ScanRequest {
  prompt: string;
  timeout?: number;
  metadata?: {
    workflowId?: string;
    executionId?: string;
    source?: string;
  };
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
