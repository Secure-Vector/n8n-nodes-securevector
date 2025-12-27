/**
 * Unit tests for API response parsing with Zod
 * Tests the ScanResponseSchema validation
 * T017: Write unit test for API response parsing
 */

import { ScanResponseSchema, ThreatSchema } from '../../nodes/SecureVector/schemas';
import { ZodError } from 'zod';
import mockResponses from '../fixtures/mock-responses.json';

describe('ScanResponse Parsing', () => {
  describe('valid responses', () => {
    it('should parse safe scan response', () => {
      const result = ScanResponseSchema.parse(mockResponses.scanResponseSafe);

      expect(result.scanId).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(result.score).toBe(5);
      expect(result.riskLevel).toBe('safe');
      expect(result.threats).toEqual([]);
      expect(result.metadata.processingTimeMs).toBe(150);
      expect(result.metadata.version).toBe('1.0.0');
    });

    it('should parse high threat scan response', () => {
      const result = ScanResponseSchema.parse(mockResponses.scanResponseHighThreat);

      expect(result.scanId).toBe('660e8400-e29b-41d4-a716-446655440001');
      expect(result.score).toBe(85);
      expect(result.riskLevel).toBe('high');
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0]?.category).toBe('prompt_injection');
    });

    it('should parse critical threat scan response with multiple threats', () => {
      const result = ScanResponseSchema.parse(mockResponses.scanResponseCriticalThreat);

      expect(result.score).toBe(95);
      expect(result.riskLevel).toBe('critical');
      expect(result.threats).toHaveLength(2);
      expect(result.threats[0]?.severity).toBe('critical');
      expect(result.threats[1]?.severity).toBe('high');
    });
  });

  describe('score validation', () => {
    it('should reject score below 0', () => {
      const invalidResponse = {
        ...mockResponses.scanResponseSafe,
        score: -1,
      };

      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow(ZodError);
      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow('Score must be >= 0');
    });

    it('should reject score above 100', () => {
      const invalidResponse = {
        ...mockResponses.scanResponseSafe,
        score: 101,
      };

      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow(ZodError);
      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow('Score must be <= 100');
    });

    it('should accept score at boundary values (0 and 100)', () => {
      const response0 = { ...mockResponses.scanResponseSafe, score: 0 };
      const response100 = { ...mockResponses.scanResponseSafe, score: 100 };

      expect(() => ScanResponseSchema.parse(response0)).not.toThrow();
      expect(() => ScanResponseSchema.parse(response100)).not.toThrow();
    });
  });

  describe('scanId validation', () => {
    it('should reject invalid UUID format', () => {
      const invalidResponse = {
        ...mockResponses.scanResponseSafe,
        scanId: 'not-a-uuid',
      };

      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow(ZodError);
      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow('Invalid scan ID format');
    });
  });

  describe('riskLevel validation', () => {
    it('should accept all valid risk levels', () => {
      const validLevels = ['safe', 'low', 'medium', 'high', 'critical'];

      validLevels.forEach((level) => {
        const response = {
          ...mockResponses.scanResponseSafe,
          riskLevel: level,
        };

        expect(() => ScanResponseSchema.parse(response)).not.toThrow();
      });
    });

    it('should reject invalid risk level', () => {
      const invalidResponse = {
        ...mockResponses.scanResponseSafe,
        riskLevel: 'unknown',
      };

      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow(ZodError);
    });
  });

  describe('timestamp validation', () => {
    it('should accept valid ISO 8601 timestamp', () => {
      const response = {
        ...mockResponses.scanResponseSafe,
        timestamp: '2025-12-27T10:30:00.000Z',
      };

      expect(() => ScanResponseSchema.parse(response)).not.toThrow();
    });

    it('should reject invalid timestamp format', () => {
      const invalidResponse = {
        ...mockResponses.scanResponseSafe,
        timestamp: '2025-12-27',
      };

      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow(ZodError);
      expect(() => ScanResponseSchema.parse(invalidResponse)).toThrow('Invalid timestamp format');
    });
  });
});

describe('Threat Parsing', () => {
  const validThreat = {
    category: 'prompt_injection',
    severity: 'high',
    title: 'Test threat',
    description: 'Test description',
    confidence: 0.92,
  };

  describe('required fields', () => {
    it('should parse valid threat with all required fields', () => {
      const result = ThreatSchema.parse(validThreat);

      expect(result.category).toBe('prompt_injection');
      expect(result.severity).toBe('high');
      expect(result.confidence).toBe(0.92);
    });

    it('should accept threat with optional location field', () => {
      const threat = {
        ...validThreat,
        location: { start: 10, end: 50 },
      };

      const result = ThreatSchema.parse(threat);
      expect(result.location).toEqual({ start: 10, end: 50 });
    });

    it('should accept threat with optional mitigation field', () => {
      const threat = {
        ...validThreat,
        mitigation: 'Sanitize input',
      };

      const result = ThreatSchema.parse(threat);
      expect(result.mitigation).toBe('Sanitize input');
    });
  });

  describe('confidence validation', () => {
    it('should reject confidence below 0', () => {
      const invalidThreat = { ...validThreat, confidence: -0.1 };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });

    it('should reject confidence above 1', () => {
      const invalidThreat = { ...validThreat, confidence: 1.1 };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });

    it('should accept confidence at boundary values (0 and 1)', () => {
      const threat0 = { ...validThreat, confidence: 0 };
      const threat1 = { ...validThreat, confidence: 1 };

      expect(() => ThreatSchema.parse(threat0)).not.toThrow();
      expect(() => ThreatSchema.parse(threat1)).not.toThrow();
    });
  });

  describe('category validation', () => {
    it('should accept all valid threat categories', () => {
      const validCategories = [
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
      ];

      validCategories.forEach((category) => {
        const threat = { ...validThreat, category };
        expect(() => ThreatSchema.parse(threat)).not.toThrow();
      });
    });

    it('should reject invalid category', () => {
      const invalidThreat = { ...validThreat, category: 'unknown_category' };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });
  });

  describe('severity validation', () => {
    it('should accept all valid severity levels', () => {
      const validSeverities = ['low', 'medium', 'high', 'critical'];

      validSeverities.forEach((severity) => {
        const threat = { ...validThreat, severity };
        expect(() => ThreatSchema.parse(threat)).not.toThrow();
      });
    });

    it('should reject invalid severity', () => {
      const invalidThreat = { ...validThreat, severity: 'extreme' };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });
  });

  describe('string length validation', () => {
    it('should reject empty title', () => {
      const invalidThreat = { ...validThreat, title: '' };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });

    it('should reject title exceeding 200 characters', () => {
      const invalidThreat = { ...validThreat, title: 'a'.repeat(201) };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });

    it('should reject description exceeding 1000 characters', () => {
      const invalidThreat = { ...validThreat, description: 'a'.repeat(1001) };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });

    it('should reject mitigation exceeding 500 characters', () => {
      const invalidThreat = {
        ...validThreat,
        mitigation: 'a'.repeat(501),
      };

      expect(() => ThreatSchema.parse(invalidThreat)).toThrow(ZodError);
    });
  });
});
