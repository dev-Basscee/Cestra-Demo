import { Injectable, Logger } from '@nestjs/common';

export type ErrorClassification = 'transient' | 'fatal';

@Injectable()
export class RetryStrategy {
  private readonly logger = new Logger(RetryStrategy.name);

  /**
   * Classify an error as transient (retryable) or fatal (non-retryable)
   */
  classifyError(error: any): ErrorClassification {
    const message = (error?.message || '').toLowerCase();
    const code = error?.code?.toUpperCase() || '';

    // Transient errors (retryable)
    if (code === 'ETIMEDOUT' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      return 'transient';
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'transient';
    }

    if (message.includes('429') || message.includes('rate limit') || message.includes('rate-limit')) {
      return 'transient';
    }

    if (message.includes('eagain') || message.includes('temporarily')) {
      return 'transient';
    }

    if (message.includes('econnreset') || message.includes('connection reset')) {
      return 'transient';
    }

    if (message.includes('econnrefused') || message.includes('connection refused')) {
      return 'transient';
    }

    if (message.includes('network') && !message.includes('network error')) {
      return 'transient';
    }

    if (message.includes('temporarily unavailable')) {
      return 'transient';
    }

    // Fatal errors (non-retryable)
    if (message.includes('invalid move call') || message.includes('function not found')) {
      return 'fatal';
    }

    if (message.includes('insufficient') && message.includes('balance')) {
      return 'fatal';
    }

    if (message.includes('type mismatch') || message.includes('invalid argument')) {
      return 'fatal';
    }

    if (message.includes('invalid') && message.includes('signature')) {
      return 'fatal';
    }

    if (message.includes('signature verification')) {
      return 'fatal';
    }

    if (message.includes('unauthorized')) {
      return 'fatal';
    }

    if (message.includes('forbidden')) {
      return 'fatal';
    }

    if (message.includes('out of gas') || message.includes('gas limit')) {
      return 'fatal';
    }

    if (message.includes('invalid transaction') || message.includes('malformed')) {
      return 'fatal';
    }

    if (message.includes('object not found') && message.includes('nonexistent')) {
      return 'fatal';
    }

    if (message.includes('not a valid') && message.includes('object')) {
      return 'fatal';
    }

    if (message.includes('invariant violation')) {
      return 'fatal';
    }

    // Default to transient (safer for retry)
    this.logger.warn(
      `Unknown error classification, defaulting to transient: ${message.substring(0, 100)}`,
    );
    return 'transient';
  }

  /**
   * Calculate backoff delay for a given attempt number
   * Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s, 32s, 32s, 32s, 32s (capped at 32s)
   */
  getBackoffDelay(attempt: number): number {
    const delays = [
      1000, // 1s - attempt 0
      2000, // 2s - attempt 1
      4000, // 4s - attempt 2
      8000, // 8s - attempt 3
      16000, // 16s - attempt 4
      32000, // 32s - attempt 5
      32000, // 32s - attempt 6
      32000, // 32s - attempt 7
      32000, // 32s - attempt 8
      32000, // 32s - attempt 9
    ];

    const delayMs = delays[Math.min(attempt, delays.length - 1)];
    this.logger.debug(`Retry attempt ${attempt}: backoff delay = ${delayMs}ms`);
    return delayMs;
  }

  /**
   * Get total max retry time estimate
   */
  getMaxRetryTimeEstimate(maxRetries: number = 10): number {
    let totalMs = 0;
    for (let i = 0; i < maxRetries; i++) {
      totalMs += this.getBackoffDelay(i);
    }
    return totalMs;
  }
}
