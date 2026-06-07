import { Test, TestingModule } from '@nestjs/testing';
import { RetryStrategy, ErrorClassification } from './retry-strategy.service';
import * as fc from 'fast-check';

describe('RetryStrategy', () => {
  let service: RetryStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RetryStrategy],
    }).compile();

    service = module.get<RetryStrategy>(RetryStrategy);
  });

  describe('classifyError', () => {
    describe('Transient Errors', () => {
      it('should classify timeout errors as transient', () => {
        const errors = [
          new Error('timeout'),
          new Error('Connection timeout'),
          new Error('Request timed out'),
          { message: 'ETIMEDOUT', code: 'ETIMEDOUT' },
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('transient');
        });
      });

      it('should classify rate limit errors as transient', () => {
        const errors = [
          new Error('429'),
          new Error('Rate limit exceeded'),
          new Error('Rate-limit: too many requests'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('transient');
        });
      });

      it('should classify connection errors as transient', () => {
        const errors = [
          { message: 'ECONNREFUSED', code: 'ECONNREFUSED' },
          new Error('Connection refused'),
          new Error('Connection reset'),
          new Error('ECONNRESET'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('transient');
        });
      });

      it('should classify temporarily unavailable as transient', () => {
        const errors = [
          new Error('Temporarily unavailable'),
          new Error('Service temporarily unavailable'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('transient');
        });
      });
    });

    describe('Fatal Errors', () => {
      it('should classify invalid move call as fatal', () => {
        const errors = [
          new Error('Invalid move call'),
          new Error('Function not found'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('fatal');
        });
      });

      it('should classify insufficient balance as fatal', () => {
        const error = new Error('Insufficient balance');
        expect(service.classifyError(error)).toBe('fatal');
      });

      it('should classify type mismatch as fatal', () => {
        const errors = [
          new Error('Type mismatch'),
          new Error('Invalid argument type'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('fatal');
        });
      });

      it('should classify signature errors as fatal', () => {
        const errors = [
          new Error('Invalid signature'),
          new Error('Signature verification failed'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('fatal');
        });
      });

      it('should classify out of gas as fatal', () => {
        const errors = [
          new Error('Out of gas'),
          new Error('Gas limit exceeded'),
        ];

        errors.forEach((error) => {
          expect(service.classifyError(error)).toBe('fatal');
        });
      });

      it('should classify object not found as fatal', () => {
        const error = new Error('Object not found - nonexistent');
        expect(service.classifyError(error)).toBe('fatal');
      });
    });

    it('should default to transient for unknown errors', () => {
      const unknownError = new Error('Some random error we have not seen before');
      expect(service.classifyError(unknownError)).toBe('transient');
    });
  });

  describe('getBackoffDelay', () => {
    it('should return exponential backoff delays', () => {
      const expectedDelays = [
        1000, // attempt 0
        2000, // attempt 1
        4000, // attempt 2
        8000, // attempt 3
        16000, // attempt 4
        32000, // attempt 5+
      ];

      expectedDelays.forEach((expectedDelay, attempt) => {
        const delay = service.getBackoffDelay(attempt);
        expect(delay).toBe(expectedDelay);
      });
    });

    it('should cap delay at 32 seconds', () => {
      expect(service.getBackoffDelay(5)).toBe(32000);
      expect(service.getBackoffDelay(6)).toBe(32000);
      expect(service.getBackoffDelay(9)).toBe(32000);
      expect(service.getBackoffDelay(100)).toBe(32000);
    });

    it('should never return negative delay', () => {
      for (let i = 0; i < 100; i++) {
        expect(service.getBackoffDelay(i)).toBeGreaterThan(0);
      }
    });
  });

  describe('getMaxRetryTimeEstimate', () => {
    it('should calculate total retry time', () => {
      const estimate = service.getMaxRetryTimeEstimate(10);
      // 1+2+4+8+16+32+32+32+32+32 = 191 seconds = 191000 ms
      expect(estimate).toBe(191000);
    });

    it('should calculate correct time for fewer retries', () => {
      const estimate3 = service.getMaxRetryTimeEstimate(3);
      // 1+2+4 = 7 seconds = 7000 ms
      expect(estimate3).toBe(7000);
    });
  });

  describe('Property: Error Classification Consistency', () => {
    it('should classify same error consistently across multiple calls', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(new Error('timeout')),
            fc.constant(new Error('Rate limit')),
            fc.constant(new Error('Invalid move call')),
            fc.constant(new Error('Insufficient balance')),
          ),
          (error) => {
            const result1 = service.classifyError(error);
            const result2 = service.classifyError(error);
            expect(result1).toBe(result2);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property: Backoff Delay Determinism', () => {
    it('should return same delay for same attempt number', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 20 }), (attempt) => {
          const delay1 = service.getBackoffDelay(attempt);
          const delay2 = service.getBackoffDelay(attempt);
          expect(delay1).toBe(delay2);
        }),
        { numRuns: 50 },
      );
    });

    it('should increase monotonically until cap', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 4 }),
            fc.integer({ min: 1, max: 4 }),
          ),
          ([attempt1, increment]) => {
            const delay1 = service.getBackoffDelay(attempt1);
            const delay2 = service.getBackoffDelay(attempt1 + increment);

            if (attempt1 + increment < 5) {
              expect(delay2).toBeGreaterThanOrEqual(delay1);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Property: Retry Time Estimate Accuracy', () => {
    it('should match sum of individual delays', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (maxRetries) => {
          const estimate = service.getMaxRetryTimeEstimate(maxRetries);

          let manualSum = 0;
          for (let i = 0; i < maxRetries; i++) {
            manualSum += service.getBackoffDelay(i);
          }

          expect(estimate).toBe(manualSum);
        }),
        { numRuns: 50 },
      );
    });
  });
});
