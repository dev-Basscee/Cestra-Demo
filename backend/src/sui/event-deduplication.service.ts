import { Injectable, Logger } from '@nestjs/common';
import * as redis from 'ioredis';

/**
 * EventDeduplicationService ensures that on-chain events are processed
 * exactly once, even if received multiple times or out of order.
 *
 * Features:
 * - Redis-based event deduplication
 * - Automatic expiration (1 hour default)
 * - Out-of-order event buffering (optional, not critical for MVP)
 * - Deterministic event ordering by (digest, event_seq)
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  wasNew: boolean;
  expirySeconds: number;
}

@Injectable()
export class EventDeduplicationService {
  private readonly logger = new Logger(EventDeduplicationService.name);
  private redisClient: redis.Redis;
  private readonly eventExpirySecs = 3600; // 1 hour
  private readonly keyPrefix = 'event:dedup:';

  constructor() {
    this.redisClient = new redis.Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redisClient.on('error', (error) => {
      this.logger.error(
        `Redis error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  /**
   * Check if event is duplicate and mark it as seen
   *
   * @param digest - Transaction digest from on-chain event
   * @param eventSeq - Event sequence number within transaction
   * @returns DuplicateCheckResult with duplicate status
   */
  async checkAndMarkDuplicate(
    digest: string,
    eventSeq: number,
  ): Promise<DuplicateCheckResult> {
    try {
      const eventKey = `${this.keyPrefix}${digest}:${eventSeq}`;

      // Check if key exists (duplicate detection)
      const exists = await this.redisClient.exists(eventKey);

      if (exists === 1) {
        this.logger.debug(
          `Duplicate event detected: ${digest}:${eventSeq}`,
        );
        return {
          isDuplicate: true,
          wasNew: false,
          expirySeconds: this.eventExpirySecs,
        };
      }

      // Mark as seen with expiration
      const result = await this.redisClient.setex(
        eventKey,
        this.eventExpirySecs,
        '1',
      );

      if (result === 'OK') {
        this.logger.debug(
          `Event marked as seen: ${digest}:${eventSeq}`,
        );
        return {
          isDuplicate: false,
          wasNew: true,
          expirySeconds: this.eventExpirySecs,
        };
      }

      throw new Error('Failed to set event key in Redis');
    } catch (error) {
      this.logger.error(
        `Error checking duplicate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Fail open - treat as not duplicate on error
      return {
        isDuplicate: false,
        wasNew: true,
        expirySeconds: this.eventExpirySecs,
      };
    }
  }

  /**
   * Mark multiple events as seen (batch operation)
   */
  async markMultipleDuplicates(
    events: Array<{ digest: string; eventSeq: number }>,
  ): Promise<number> {
    if (events.length === 0) {
      return 0;
    }

    try {
      const pipeline = this.redisClient.pipeline();

      for (const event of events) {
        const eventKey = `${this.keyPrefix}${event.digest}:${event.eventSeq}`;
        pipeline.setex(eventKey, this.eventExpirySecs, '1');
      }

      await pipeline.exec();

      this.logger.debug(`Marked ${events.length} events as seen`);
      return events.length;
    } catch (error) {
      this.logger.error(
        `Error marking multiple duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return 0;
    }
  }

  /**
   * Clear deduplication cache (for testing or recovery)
   */
  async clearCache(): Promise<void> {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redisClient.keys(pattern);

      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.log(`Cleared ${keys.length} deduplication keys`);
      }
    } catch (error) {
      this.logger.error(
        `Error clearing cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get deduplication statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
  }> {
    try {
      const keys = await this.redisClient.keys(`${this.keyPrefix}*`);
      const info = await this.redisClient.info('memory');

      // Extract used_memory from info string
      const usedMemoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = usedMemoryMatch
        ? parseInt(usedMemoryMatch[1])
        : 0;

      return {
        totalKeys: keys.length,
        memoryUsage,
      };
    } catch (error) {
      this.logger.error(
        `Error getting stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        totalKeys: 0,
        memoryUsage: 0,
      };
    }
  }

  /**
   * Check if specific event has been seen
   */
  async hasBeenSeen(digest: string, eventSeq: number): Promise<boolean> {
    try {
      const eventKey = `${this.keyPrefix}${digest}:${eventSeq}`;
      const exists = await this.redisClient.exists(eventKey);
      return exists === 1;
    } catch (error) {
      this.logger.warn(
        `Error checking if event has been seen: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  /**
   * Get remaining TTL for an event key
   */
  async getTTL(digest: string, eventSeq: number): Promise<number> {
    try {
      const eventKey = `${this.keyPrefix}${digest}:${eventSeq}`;
      const ttl = await this.redisClient.ttl(eventKey);
      return ttl; // Returns -1 if key doesn't exist, -2 if no expiry
    } catch (error) {
      this.logger.warn(
        `Error getting TTL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return -1;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.redisClient.quit();
      this.logger.log('Disconnected from Redis');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
