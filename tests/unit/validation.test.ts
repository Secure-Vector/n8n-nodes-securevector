/**
 * Unit tests for prompt validation
 * Tests the ScanRequestSchema Zod validation
 * T015: Write unit test for prompt validation
 */

import { ScanRequestSchema } from '../../nodes/SecureVector/schemas';
import { ZodError } from 'zod';

describe('ScanRequest Validation', () => {
  describe('prompt field', () => {
    it('should accept valid prompt text', () => {
      const validRequest = {
        prompt: 'Please summarize this document',
      };

      const result = ScanRequestSchema.parse(validRequest);
      expect(result.prompt).toBe('Please summarize this document');
    });

    it('should reject empty prompt', () => {
      const invalidRequest = {
        prompt: '',
      };

      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(ZodError);
      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow('Prompt cannot be empty');
    });

    it('should reject prompt exceeding 10,000 characters', () => {
      const invalidRequest = {
        prompt: 'a'.repeat(10001),
      };

      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(ZodError);
      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(
        'Prompt exceeds maximum length of 10,000 characters',
      );
    });

    it('should accept prompt at exactly 10,000 characters', () => {
      const validRequest = {
        prompt: 'a'.repeat(10000),
      };

      const result = ScanRequestSchema.parse(validRequest);
      expect(result.prompt).toHaveLength(10000);
    });
  });

  describe('timeout field', () => {
    it('should use default timeout of 30 seconds when not provided', () => {
      const request = {
        prompt: 'Test prompt',
      };

      const result = ScanRequestSchema.parse(request);
      expect(result.timeout).toBe(30);
    });

    it('should accept valid timeout value', () => {
      const request = {
        prompt: 'Test prompt',
        timeout: 60,
      };

      const result = ScanRequestSchema.parse(request);
      expect(result.timeout).toBe(60);
    });

    it('should reject timeout less than 1 second', () => {
      const invalidRequest = {
        prompt: 'Test prompt',
        timeout: 0,
      };

      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should reject timeout greater than 300 seconds', () => {
      const invalidRequest = {
        prompt: 'Test prompt',
        timeout: 301,
      };

      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should reject non-integer timeout', () => {
      const invalidRequest = {
        prompt: 'Test prompt',
        timeout: 30.5,
      };

      expect(() => ScanRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });
  });

  describe('metadata field', () => {
    it('should accept valid metadata with all fields', () => {
      const request = {
        prompt: 'Test prompt',
        metadata: {
          workflowId: 'wf_123',
          executionId: 'exec_456',
          source: 'n8n-workflow',
        },
      };

      const result = ScanRequestSchema.parse(request);
      expect(result.metadata).toEqual({
        workflowId: 'wf_123',
        executionId: 'exec_456',
        source: 'n8n-workflow',
      });
    });

    it('should accept metadata with partial fields', () => {
      const request = {
        prompt: 'Test prompt',
        metadata: {
          workflowId: 'wf_123',
        },
      };

      const result = ScanRequestSchema.parse(request);
      expect(result.metadata?.workflowId).toBe('wf_123');
      expect(result.metadata?.executionId).toBeUndefined();
    });

    it('should accept request without metadata', () => {
      const request = {
        prompt: 'Test prompt',
      };

      const result = ScanRequestSchema.parse(request);
      expect(result.metadata).toBeUndefined();
    });
  });
});
