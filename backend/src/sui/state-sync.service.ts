import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ParsedEvent } from './on-chain-monitor.service';
import { EventRoutingService } from './event-routing.service';
import { Transaction } from '../blockchain/entities/transaction.entity';
import { BatchPayout } from '../blockchain/entities/batch-payout.entity';
import { YieldDeposit } from '../blockchain/entities/yield-deposit.entity';
import { SavingsCircle } from '../blockchain/entities/savings-circle.entity';
import { RateLock } from '../blockchain/entities/rate-lock.entity';
import { CrossChainTransfer } from '../blockchain/entities/cross-chain-transfer.entity';

/**
 * StateSyncService listens for on-chain events and updates PostgreSQL entities
 * to maintain a synchronized local replica of on-chain state.
 *
 * Features:
 * - Event-driven database updates
 * - ACID transaction wrapping for atomicity
 * - Validation of required event fields
 * - Comprehensive error handling and alerting
 * - Per-module event handlers
 */

export interface StateSyncResult {
  success: boolean;
  entityType: string;
  entityId?: string;
  error?: string;
  timestamp: number;
}

@Injectable()
export class StateSyncService {
  private readonly logger = new Logger(StateSyncService.name);

  constructor(
    private dataSource: DataSource,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(BatchPayout)
    private batchPayoutRepository: Repository<BatchPayout>,
    @InjectRepository(YieldDeposit)
    private yieldDepositRepository: Repository<YieldDeposit>,
    @InjectRepository(SavingsCircle)
    private savingsCircleRepository: Repository<SavingsCircle>,
    @InjectRepository(RateLock)
    private rateLockRepository: Repository<RateLock>,
    @InjectRepository(CrossChainTransfer)
    private crossChainTransferRepository: Repository<CrossChainTransfer>,
    private eventRoutingService: EventRoutingService,
  ) {
    this.registerHandlers();
  }

  /**
   * Register event handlers with the routing service
   */
  private registerHandlers(): void {
    this.eventRoutingService.registerHandlers([
      {
        eventType: 'cestra::send::SentEvent',
        handler: (event) => this.onSendEvent(event),
      },
      {
        eventType: 'cestra::pool::PoolCreatedEvent',
        handler: (event) => this.onPoolCreatedEvent(event),
      },
      {
        eventType: 'cestra::pool::PoolContributedEvent',
        handler: (event) => this.onPoolContributedEvent(event),
      },
      {
        eventType: 'cestra::pool::PoolExecutedEvent',
        handler: (event) => this.onPoolExecutedEvent(event),
      },
      {
        eventType: 'cestra::yield::YieldDepositedEvent',
        handler: (event) => this.onYieldDepositedEvent(event),
      },
      {
        eventType: 'cestra::yield::YieldAccruedEvent',
        handler: (event) => this.onYieldAccruedEvent(event),
      },
      {
        eventType: 'cestra::circle::CircleCreatedEvent',
        handler: (event) => this.onCircleCreatedEvent(event),
      },
      {
        eventType: 'cestra::circle::CirclePayoutTriggeredEvent',
        handler: (event) => this.onCirclePayoutTriggeredEvent(event),
      },
      {
        eventType: 'cestra::ratelock::RateLockCreatedEvent',
        handler: (event) => this.onRateLockCreatedEvent(event),
      },
      {
        eventType: 'cestra::ratelock::RateLockFilledEvent',
        handler: (event) => this.onRateLockFilledEvent(event),
      },
      {
        eventType: 'cestra::ratelock::RateLockExpiredEvent',
        handler: (event) => this.onRateLockExpiredEvent(event),
      },
      {
        eventType: 'cestra::bridge::BridgeCctpReceiveCompleted',
        handler: (event) => this.onBridgeCctpCompletedEvent(event),
      },
      {
        eventType: 'cestra::bridge::BridgeWormholeReceiveCompleted',
        handler: (event) => this.onBridgeWormholeCompletedEvent(event),
      },
    ]);

    this.logger.log('State sync handlers registered');
  }

  /**
   * Handle SendEvent: Update Transaction entity
   */
  async onSendEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'sender',
        'recipient',
        'amount',
        'fee',
      ]);

      const { sender, recipient, amount, fee } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        // Try to find existing transaction by digest
        let transaction = await manager.findOne(Transaction, {
          where: { on_chain_digest: event.digest },
        });

        if (transaction) {
          // Update existing
          transaction.status = 'CONFIRMED';
          transaction.on_chain_timestamp = new Date(event.timestamp);
          await manager.save(transaction);

          this.logger.debug(
            `Updated Transaction: ${transaction.id} (digest: ${event.digest})`,
          );
        } else {
          // Create new
          transaction = manager.create(Transaction, {
            sender,
            recipient,
            amount: BigInt(amount),
            fee: BigInt(fee),
            kyc_tier: 1, // Will be updated by compliance engine
            status: 'CONFIRMED',
            on_chain_digest: event.digest,
            on_chain_timestamp: new Date(event.timestamp),
          });

          await manager.save(transaction);

          this.logger.debug(
            `Created Transaction: ${transaction.id} (digest: ${event.digest})`,
          );
        }
      });
    } catch (error) {
      this.logger.error(
        `Error handling SendEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle PoolCreatedEvent: Create BatchPayout entity
   */
  async onPoolCreatedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'pool_id',
        'target_recipients',
      ]);

      const { pool_id, name, target_recipients } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const batchPayout = manager.create(BatchPayout, {
          pool_id,
          name: name || 'Unnamed Pool',
          status: 'ACTIVE',
          target_recipients: target_recipients || [],
          contributors: [],
          total_amount: BigInt(0),
        });

        await manager.save(batchPayout);

        this.logger.debug(
          `Created BatchPayout: ${batchPayout.id} (pool_id: ${pool_id})`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling PoolCreatedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle PoolContributedEvent: Update BatchPayout contributor balances
   */
  async onPoolContributedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'pool_id',
        'contributor',
        'amount',
      ]);

      const { pool_id, contributor, amount } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const batchPayout = await manager.findOne(BatchPayout, {
          where: { pool_id },
        });

        if (!batchPayout) {
          this.logger.warn(
            `BatchPayout not found for pool_id: ${pool_id}`,
          );
          return;
        }

        // Update contributors array
        const contributors = batchPayout.contributors || [];
        const existingContributor = contributors.find(
          (c: any) => c.address === contributor,
        );

        if (existingContributor) {
          existingContributor.amount = (BigInt(existingContributor.amount) + BigInt(amount)).toString();
        } else {
          contributors.push({
            address: contributor,
            amount: amount.toString(),
          });
        }

        batchPayout.contributors = contributors;
        batchPayout.total_amount = contributors.reduce(
          (sum: bigint, c: any) => sum + BigInt(c.amount),
          BigInt(0),
        );

        await manager.save(batchPayout);

        this.logger.debug(
          `Updated BatchPayout contributors: ${batchPayout.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling PoolContributedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle PoolExecutedEvent: Update BatchPayout status
   */
  async onPoolExecutedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, ['pool_id']);

      const { pool_id } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const batchPayout = await manager.findOne(BatchPayout, {
          where: { pool_id },
        });

        if (!batchPayout) {
          this.logger.warn(
            `BatchPayout not found for pool_id: ${pool_id}`,
          );
          return;
        }

        batchPayout.status = 'EXECUTED';
        batchPayout.executed_at = new Date(event.timestamp);

        await manager.save(batchPayout);

        this.logger.debug(
          `Updated BatchPayout status to EXECUTED: ${batchPayout.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling PoolExecutedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle YieldDepositedEvent: Create YieldDeposit entity
   */
  async onYieldDepositedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'user_address',
        'vault_id',
        'amount',
        'shares',
      ]);

      const { user_address, vault_id, amount, shares } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const yieldDeposit = manager.create(YieldDeposit, {
          user_address,
          vault_id,
          amount: BigInt(amount),
          shares: BigInt(shares),
          accrued_value: BigInt(amount),
          status: 'ACTIVE',
          deposited_at: new Date(event.timestamp),
        });

        await manager.save(yieldDeposit);

        this.logger.debug(
          `Created YieldDeposit: ${yieldDeposit.id} (vault_id: ${vault_id})`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling YieldDepositedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle YieldAccruedEvent: Update YieldDeposit accrued values
   */
  async onYieldAccruedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'vault_id',
        'accrued_value',
      ]);

      const { vault_id, accrued_value } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const deposits = await manager.find(YieldDeposit, {
          where: { vault_id, status: 'ACTIVE' },
        });

        for (const deposit of deposits) {
          deposit.accrued_value = BigInt(accrued_value);
          await manager.save(deposit);
        }

        this.logger.debug(
          `Updated ${deposits.length} YieldDeposits for vault: ${vault_id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling YieldAccruedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle CircleCreatedEvent: Create SavingsCircle entity
   */
  async onCircleCreatedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'circle_id',
        'members',
      ]);

      const { circle_id, name, members } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const circle = manager.create(SavingsCircle, {
          circle_id,
          name: name || 'Unnamed Circle',
          members: members || [],
          current_round: 1,
          payout_schedule: [],
          status: 'ACTIVE',
        });

        await manager.save(circle);

        this.logger.debug(
          `Created SavingsCircle: ${circle.id} (circle_id: ${circle_id})`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling CircleCreatedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle CirclePayoutTriggeredEvent: Update SavingsCircle payout status
   */
  async onCirclePayoutTriggeredEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'circle_id',
        'recipient',
        'amount',
      ]);

      const { circle_id, recipient, amount, round } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const circle = await manager.findOne(SavingsCircle, {
          where: { circle_id },
        });

        if (!circle) {
          this.logger.warn(
            `SavingsCircle not found for circle_id: ${circle_id}`,
          );
          return;
        }

        // Update payout schedule
        const schedule = circle.payout_schedule || [];
        schedule.push({
          round: round || circle.current_round,
          recipient,
          amount: amount.toString(),
          paid_at: event.timestamp,
        });

        circle.payout_schedule = schedule;
        circle.current_round = (circle.current_round || 1) + 1;

        await manager.save(circle);

        this.logger.debug(
          `Updated SavingsCircle payout: ${circle.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling CirclePayoutTriggeredEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle RateLockCreatedEvent: Create RateLock entity
   */
  async onRateLockCreatedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'lock_id',
        'locked_amount',
        'fx_rate',
        'expiry_at',
      ]);

      const { lock_id, business_id, locked_amount, fx_rate, expiry_at } =
        event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const rateLock = manager.create(RateLock, {
          lock_id,
          business_id,
          locked_amount: BigInt(locked_amount),
          fx_rate: parseFloat(fx_rate),
          expiry_at: new Date(parseInt(expiry_at) * 1000),
          status: 'ACTIVE',
        });

        await manager.save(rateLock);

        this.logger.debug(
          `Created RateLock: ${rateLock.id} (lock_id: ${lock_id})`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling RateLockCreatedEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle RateLockFilledEvent: Update RateLock status
   */
  async onRateLockFilledEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, ['lock_id']);

      const { lock_id } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const rateLock = await manager.findOne(RateLock, {
          where: { lock_id },
        });

        if (!rateLock) {
          this.logger.warn(
            `RateLock not found for lock_id: ${lock_id}`,
          );
          return;
        }

        rateLock.status = 'USED';

        await manager.save(rateLock);

        this.logger.debug(
          `Updated RateLock status to USED: ${rateLock.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling RateLockFilledEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle RateLockExpiredEvent: Update RateLock status
   */
  async onRateLockExpiredEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, ['lock_id']);

      const { lock_id } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const rateLock = await manager.findOne(RateLock, {
          where: { lock_id },
        });

        if (!rateLock) {
          this.logger.warn(
            `RateLock not found for lock_id: ${lock_id}`,
          );
          return;
        }

        rateLock.status = 'EXPIRED';

        await manager.save(rateLock);

        this.logger.debug(
          `Updated RateLock status to EXPIRED: ${rateLock.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling RateLockExpiredEvent: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle BridgeCctpReceiveCompleted: Update CrossChainTransfer
   */
  async onBridgeCctpCompletedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'message_id',
        'receiver',
        'amount',
      ]);

      const { message_id, receiver, amount } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const transfer = await manager.findOne(CrossChainTransfer, {
          where: { message_id },
        });

        if (!transfer) {
          this.logger.warn(
            `CrossChainTransfer not found for message_id: ${message_id}`,
          );
          return;
        }

        transfer.status = 'RECEIVED';
        transfer.received_amount = BigInt(amount);
        transfer.received_at = new Date(event.timestamp);

        await manager.save(transfer);

        this.logger.debug(
          `Updated CrossChainTransfer status to RECEIVED: ${transfer.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling BridgeCctpReceiveCompleted: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Handle BridgeWormholeReceiveCompleted: Update CrossChainTransfer
   */
  async onBridgeWormholeCompletedEvent(event: ParsedEvent): Promise<void> {
    try {
      this.validateRequiredFields(event, [
        'message_id',
        'receiver',
        'amount',
      ]);

      const { message_id, receiver, amount } = event.parsedJson;

      await this.dataSource.transaction(async (manager) => {
        const transfer = await manager.findOne(CrossChainTransfer, {
          where: { message_id },
        });

        if (!transfer) {
          this.logger.warn(
            `CrossChainTransfer not found for message_id: ${message_id}`,
          );
          return;
        }

        transfer.status = 'RECEIVED';
        transfer.received_amount = BigInt(amount);
        transfer.received_at = new Date(event.timestamp);

        await manager.save(transfer);

        this.logger.debug(
          `Updated CrossChainTransfer status to RECEIVED: ${transfer.id}`,
        );
      });
    } catch (error) {
      this.logger.error(
        `Error handling BridgeWormholeReceiveCompleted: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Validate that required fields exist in event
   */
  private validateRequiredFields(
    event: ParsedEvent,
    requiredFields: string[],
  ): void {
    for (const field of requiredFields) {
      if (!(field in event.parsedJson)) {
        throw new Error(
          `Event missing required field: ${field} (type: ${event.eventType})`,
        );
      }
    }
  }

  /**
   * Manually sync a transaction by digest
   */
  async manualSyncTransaction(digest: string): Promise<StateSyncResult> {
    try {
      const transaction = await this.transactionRepository.findOne({
        where: { on_chain_digest: digest },
      });

      if (!transaction) {
        return {
          success: false,
          entityType: 'Transaction',
          error: 'Transaction not found',
          timestamp: Date.now(),
        };
      }

      // In a real implementation, this would query Sui RPC
      // For now, just return success
      return {
        success: true,
        entityType: 'Transaction',
        entityId: transaction.id,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        entityType: 'Transaction',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }
}
