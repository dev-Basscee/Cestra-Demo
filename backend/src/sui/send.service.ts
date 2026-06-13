import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../blockchain/entities/transaction.entity';
import { User } from '../auth/entities/user.entity';
import { TransactionBuilderService } from './transaction-builder.service';
import { TransactionSubmissionService } from './transaction-submission.service';
import { ComplianceEngine } from './compliance-engine.service';
import { RateLockService } from './ratelock.service';
import { WebhookService } from './webhook.service';

export interface SendRequest {
  sender: string;
  recipient: string;
  amount: bigint;
  rateLockId?: string;
}

export interface SendResponse {
  transactionId: string;
  status: string;
  digest?: string;
  estimatedFee: string;
  createdAt: string;
}

@Injectable()
export class SendService {
  private readonly logger = new Logger(SendService.name);

  constructor(
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private transactionBuilderService: TransactionBuilderService,
    private transactionSubmissionService: TransactionSubmissionService,
    private complianceEngine: ComplianceEngine,
    private rateLockService: RateLockService,
    private webhookService: WebhookService,
  ) {}

  /**
   * Initiate a send transaction with compliance validation
   * 
   * Flow:
   * 1. Validate compliance (KYC, limit, blacklist, OFAC)
   * 2. Fetch user and build transaction
   * 3. Apply rate-lock if provided
   * 4. Submit to Sui with retry logic
   * 5. Return submission result to caller
   * 
   * @param request Send request with sender, recipient, amount, optional rate-lock
   * @returns Send response with transaction ID and status
   * @throws ForbiddenException if compliance validation fails
   * @throws BadRequestException if input validation fails
   */
  async initiateSend(request: SendRequest): Promise<SendResponse> {
    const { sender, recipient, amount, rateLockId } = request;

    this.logger.debug(`Send initiated: sender=${sender}, recipient=${recipient}, amount=${amount}, rateLockId=${rateLockId}`);

    // Input validation
    if (!sender || !recipient) {
      throw new BadRequestException('Sender and recipient addresses are required');
    }
    if (!amount || amount <= 0n) {
      throw new BadRequestException('Amount must be positive');
    }

    // Compliance validation: KYC, limits, blacklist, OFAC
    const complianceResult = await this.complianceEngine.validateBeforeSubmission(
      sender,
      recipient,
      amount,
      'send',
    );

    if (!complianceResult.approved) {
      this.logger.warn(
        `Send rejected by compliance: sender=${sender}, reason=${complianceResult.reason}`,
      );
      throw new ForbiddenException(complianceResult.reason);
    }

    // Fetch user for additional context
    const user = await this.userRepository.findOne({ where: { wallet_address: sender } });
    if (!user) {
      throw new BadRequestException('Sender user not found');
    }

    // Apply rate-lock if provided
    let appliedRate: string | undefined;
    if (rateLockId) {
      appliedRate = await this.rateLockService.applyLock(rateLockId, sender, amount);
    }

    // Build Send transaction
    const buildResult = await this.transactionBuilderService.buildSendTransaction({
      sender,
      recipient,
      amount,
      kycTier: complianceResult.kyc_tier || 0,
    });

    if (!buildResult.success) {
      this.logger.error(`Failed to build Send transaction: ${buildResult.error}`);
      throw new BadRequestException(`Transaction build failed: ${buildResult.error}`);
    }

    // Calculate fee (0.80% of amount)
    const fee = (amount * 80n) / 10000n;

    // Submit transaction with retry logic
    let submitResult;
    try {
      submitResult = await this.transactionSubmissionService.submitWithRetry(
        buildResult.signedTx,
        buildResult.idempotencyKey,
        10, // max 10 retries
      );
    } catch (error) {
      this.logger.error(`Send submission failed: ${error.message}`);
      throw new BadRequestException(`Transaction submission failed: ${error.message}`);
    }

    // Store transaction in database
    const txEntity = this.transactionRepository.create({
      sender,
      recipient,
      amount: amount.toString(),
      fee: fee.toString(),
      kyc_tier: complianceResult.kyc_tier || 0,
      status: 'SUBMITTED',
      on_chain_digest: submitResult.digest,
      user_id: user.id,
    });

    await this.transactionRepository.save(txEntity);

    this.logger.info(
      `Send submitted successfully: txId=${txEntity.id}, digest=${submitResult.digest}, amount=${amount}`,
    );

    return {
      transactionId: txEntity.id,
      status: 'SUBMITTED',
      digest: submitResult.digest,
      estimatedFee: fee.toString(),
      createdAt: txEntity.created_at.toISOString(),
    };
  }

  /**
   * Query transaction status by ID
   * 
   * @param transactionId Transaction UUID
   * @returns Transaction details with current status
   * @throws BadRequestException if transaction not found
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    const tx = await this.transactionRepository.findOne({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new BadRequestException('Transaction not found');
    }

    return {
      id: tx.id,
      sender: tx.sender,
      recipient: tx.recipient,
      amount: tx.amount,
      fee: tx.fee,
      kyc_tier: tx.kyc_tier,
      status: tx.status,
      on_chain_digest: tx.on_chain_digest,
      created_at: tx.created_at.toISOString(),
      updated_at: tx.updated_at.toISOString(),
    };
  }

  /**
   * Query transaction history with filtering
   * 
   * @param filter Optional sender, recipient, status
   * @param limit Pagination limit (default 20)
   * @param offset Pagination offset (default 0)
   * @returns Paginated transaction list
   */
  async getTransactionHistory(
    filter?: { sender?: string; recipient?: string; status?: string },
    limit = 20,
    offset = 0,
  ): Promise<any> {
    let query = this.transactionRepository.createQueryBuilder('tx');

    if (filter?.sender) {
      query = query.where('tx.sender = :sender', { sender: filter.sender });
    }

    if (filter?.recipient) {
      query = query.andWhere('tx.recipient = :recipient', { recipient: filter.recipient });
    }

    if (filter?.status) {
      query = query.andWhere('tx.status = :status', { status: filter.status });
    }

    const [items, total] = await query
      .orderBy('tx.created_at', 'DESC')
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return {
      items: items.map((tx) => ({
        id: tx.id,
        sender: tx.sender,
        recipient: tx.recipient,
        amount: tx.amount,
        fee: tx.fee,
        status: tx.status,
        created_at: tx.created_at.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  /**
   * Called by StateSyncService when SendEvent is received
   * Updates transaction with on-chain confirmation details
   * 
   * @param digest Transaction digest
   * @param event On-chain SendEvent
   */
  async onSendConfirmed(digest: string, event: any): Promise<void> {
    const tx = await this.transactionRepository.findOne({
      where: { on_chain_digest: digest },
    });

    if (!tx) {
      this.logger.warn(`SendEvent received but transaction not found: digest=${digest}`);
      return;
    }

    // Update transaction status
    tx.status = 'CONFIRMED';
    tx.updated_at = new Date();
    await this.transactionRepository.save(tx);

    this.logger.info(`Send confirmed on-chain: txId=${tx.id}, digest=${digest}`);

    // Notify user via webhook
    try {
      await this.webhookService.notifyTransactionConfirmed(tx);
    } catch (error) {
      this.logger.error(`Failed to send webhook notification: ${error.message}`);
    }
  }

  /**
   * Called by TransactionSubmissionService when Send fails
   * Updates transaction with failure details
   * 
   * @param digest Transaction digest
   * @param error Error reason
   */
  async onSendFailed(digest: string, error: string): Promise<void> {
    const tx = await this.transactionRepository.findOne({
      where: { on_chain_digest: digest },
    });

    if (!tx) {
      this.logger.warn(`Send failure but transaction not found: digest=${digest}`);
      return;
    }

    // Update transaction status
    tx.status = 'FAILED';
    tx.root_cause = error;
    tx.updated_at = new Date();
    await this.transactionRepository.save(tx);

    this.logger.error(`Send failed: txId=${tx.id}, digest=${digest}, error=${error}`);

    // Notify user via webhook
    try {
      await this.webhookService.notifyTransactionFailed(tx, error);
    } catch (error) {
      this.logger.error(`Failed to send webhook notification: ${error.message}`);
    }
  }
}
