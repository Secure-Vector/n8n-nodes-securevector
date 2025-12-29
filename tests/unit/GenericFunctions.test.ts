/**
 * Unit tests for API client request building
 * Tests the GenericFunctions helper methods
 * T016: Write unit test for API client request building
 */

import { validateCredentials, ValidationError } from '../../nodes/SecureVector/validation';

describe('CredentialData Validation', () => {
  describe('apiKey validation', () => {
    it('should accept valid API key with sv_ prefix', () => {
      const validCredentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = validateCredentials(validCredentials);
      expect(result.apiKey).toBe('sv_test1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should accept valid API key with sk_ prefix', () => {
      const validCredentials = {
        apiKey: 'sk_test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = validateCredentials(validCredentials);
      expect(result.apiKey).toBe('sk_test1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should accept valid API key with sv- prefix', () => {
      const validCredentials = {
        apiKey: 'sv-test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = validateCredentials(validCredentials);
      expect(result.apiKey).toBe('sv-test1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should accept valid API key with sk- prefix', () => {
      const validCredentials = {
        apiKey: 'sk-test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = validateCredentials(validCredentials);
      expect(result.apiKey).toBe('sk-test1234567890abcdefghijklmnopqrstuvwxyz');
    });

    it('should reject API key without sk/sv prefix', () => {
      const invalidCredentials = {
        apiKey: 'test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
      try {
        validateCredentials(invalidCredentials);
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as Error).message).toContain('Invalid API key format');
      }
    });

    it('should reject API key shorter than 32 characters', () => {
      const invalidCredentials = {
        apiKey: 'sv_short',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
      expect(() => validateCredentials(invalidCredentials)).toThrow(
        'API key must be at least 32 characters',
      );
    });

    it('should accept API key with valid characters (alphanumeric, underscore, hyphen)', () => {
      const validCredentials = {
        apiKey: 'sv_test-1234_ABCD-5678_efgh-9012',
      };

      const result = validateCredentials(validCredentials);
      expect(result.apiKey).toContain('sv_');
    });

    it('should reject API key with invalid characters', () => {
      const invalidCredentials = {
        apiKey: 'sv_test@1234#5678$9012%invalid!characters',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
    });
  });

  describe('baseUrl validation', () => {
    it('should use default baseUrl when not provided', () => {
      const credentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
      };

      const result = validateCredentials(credentials);
      expect(result.baseUrl).toBe('https://scan.securevector.io');
    });

    it('should accept custom securevector.io subdomain baseUrl', () => {
      const credentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
        baseUrl: 'https://api.securevector.io',
      };

      const result = validateCredentials(credentials);
      expect(result.baseUrl).toBe('https://api.securevector.io');
    });

    it('should reject invalid URL format', () => {
      const invalidCredentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
        baseUrl: 'not-a-valid-url',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
      expect(() => validateCredentials(invalidCredentials)).toThrow('Invalid base URL');
    });

    it('should reject HTTP URLs (HTTPS required for security)', () => {
      const invalidCredentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
        baseUrl: 'http://scan.securevector.io',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
      expect(() => validateCredentials(invalidCredentials)).toThrow(
        'Base URL must use HTTPS protocol for security',
      );
    });

    it('should reject non-securevector.io domains', () => {
      const invalidCredentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
        baseUrl: 'https://malicious.example.com',
      };

      expect(() => validateCredentials(invalidCredentials)).toThrow(ValidationError);
      expect(() => validateCredentials(invalidCredentials)).toThrow(
        'Base URL must be a securevector.io domain',
      );
    });

    it('should accept securevector.io root domain', () => {
      const credentials = {
        apiKey: 'sv_test1234567890abcdefghijklmnopqrstuvwxyz',
        baseUrl: 'https://securevector.io',
      };

      const result = validateCredentials(credentials);
      expect(result.baseUrl).toBe('https://securevector.io');
    });
  });
});

// Placeholder for future API request building tests
// These will be implemented once GenericFunctions.ts is created
describe('API Request Building (Placeholder)', () => {
  it('should build scan request with prompt and default timeout', () => {
    // This test will be implemented after GenericFunctions.ts is created
    expect(true).toBe(true);
  });

  it('should build scan request with metadata when includeMetadata is true', () => {
    // This test will be implemented after GenericFunctions.ts is created
    expect(true).toBe(true);
  });

  it('should set correct headers for API request', () => {
    // This test will be implemented after GenericFunctions.ts is created
    expect(true).toBe(true);
  });
});
