import { Transaction, TransactionStatus } from './transaction.entity';
import { PendingTransaction, PendingTransactionStatus } from './pending-transaction.entity';
import { BatchPayout, BatchPayoutStatus } from './batch-payout.entity';
import { YieldDeposit, YieldDepositStatus } from './yield-deposit.entity';
import { SavingsCircle, SavingsCircleStatus } from './savings-circle.entity';
import { RateLock, RateLockStatus } from './rate-lock.entity';
import { CrossChainTransfer, CrossChainTransferStatus, BridgeProtocol } from './cross-chain-transfer.entity';

describe('Blockchain Entities', () => {
  describe('Transaction Entity', () => {
    it('should instantiate with valid data', () => {
      const transaction = new Transaction();
      transaction.id = '123e4567-e89b-12d3-a456-426614174000';
      transaction.sender = '0x1234567890abcdef';
      transaction.recipient = '0xfedcba0987654321';
      transaction.amount = BigInt('1000000');
      transaction.fee = BigInt('8000');
      transaction.kycTier = 2;
      transaction.status = TransactionStatus.CONFIRMED;
      transaction.onChainDigest = '0xabcd1234';
      transaction.rootCause = null;
      transaction.userId = null;
      transaction.createdAt = new Date();
      transaction.updatedAt = new Date();

      expect(transaction.id).toBeDefined();
      expect(transaction.sender).toBe('0x1234567890abcdef');
      expect(transaction.amount).toBe(BigInt('1000000'));
      expect(transaction.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should have valid status enum values', () => {
      expect(TransactionStatus.PENDING).toBe('PENDING');
      expect(TransactionStatus.SUBMITTED).toBe('SUBMITTED');
      expect(TransactionStatus.CONFIRMED).toBe('CONFIRMED');
      expect(TransactionStatus.FAILED).toBe('FAILED');
    });
  });

  describe('PendingTransaction Entity', () => {
    it('should instantiate with valid data', () => {
      const pending = new PendingTransaction();
      pending.id = '123e4567-e89b-12d3-a456-426614174000';
      pending.sender = '0x1234567890abcdef';
      pending.function = 'send::send_payment';
      pending.arguments = { sender: '0x1234', recipient: '0x5678', amount: '1000' };
      pending.status = PendingTransactionStatus.SUBMITTED;
      pending.idempotencyKey = 'uuid-key-1234';
      pending.signedTxBytes = 'base64encodedstring';
      pending.retryCount = 0;
      pending.lastRetryAt = null;
      pending.errorMessage = null;
      pending.createdAt = new Date();
      pending.updatedAt = new Date();

      expect(pending.id).toBeDefined();
      expect(pending.sender).toBe('0x1234567890abcdef');
      expect(pending.status).toBe(PendingTransactionStatus.SUBMITTED);
      expect(pending.idempotencyKey).toBe('uuid-key-1234');
    });

    it('should have valid status enum values', () => {
      expect(PendingTransactionStatus.SUBMITTED).toBe('SUBMITTED');
      expect(PendingTransactionStatus.CONFIRMED).toBe('CONFIRMED');
      expect(PendingTransactionStatus.FAILED).toBe('FAILED');
    });
  });

  describe('BatchPayout Entity', () => {
    it('should instantiate with valid data', () => {
      const batch = new BatchPayout();
      batch.id = '123e4567-e89b-12d3-a456-426614174000';
      batch.poolId = '0xpool123';
      batch.name = 'Emergency Relief Fund';
      batch.status = BatchPayoutStatus.ACTIVE;
      batch.targetRecipients = [
        { recipient: '0xrec1', amount: '1000000' },
        { recipient: '0xrec2', amount: '2000000' },
      ];
      batch.contributors = [{ contributor: '0xcont1', amount: '3000000' }];
      batch.totalAmount = BigInt('3000000');
      batch.executedAt = null;
      batch.createdAt = new Date();
      batch.updatedAt = new Date();

      expect(batch.poolId).toBe('0xpool123');
      expect(batch.status).toBe(BatchPayoutStatus.ACTIVE);
      expect(batch.targetRecipients).toHaveLength(2);
    });

    it('should have valid status enum values', () => {
      expect(BatchPayoutStatus.ACTIVE).toBe('ACTIVE');
      expect(BatchPayoutStatus.EXECUTING).toBe('EXECUTING');
      expect(BatchPayoutStatus.EXECUTED).toBe('EXECUTED');
      expect(BatchPayoutStatus.REFUNDING).toBe('REFUNDING');
      expect(BatchPayoutStatus.REFUNDED).toBe('REFUNDED');
    });
  });

  describe('YieldDeposit Entity', () => {
    it('should instantiate with valid data', () => {
      const deposit = new YieldDeposit();
      deposit.id = '123e4567-e89b-12d3-a456-426614174000';
      deposit.userId = 'user-123';
      deposit.vaultId = '0xvault123';
      deposit.amount = BigInt('1000000');
      deposit.shares = BigInt('1000000');
      deposit.accruedValue = BigInt('1050000');
      deposit.status = YieldDepositStatus.ACTIVE;
      deposit.depositedAt = new Date();
      deposit.withdrawnAt = null;
      deposit.createdAt = new Date();
      deposit.updatedAt = new Date();

      expect(deposit.userId).toBe('user-123');
      expect(deposit.accruedValue).toBe(BigInt('1050000'));
      expect(deposit.status).toBe(YieldDepositStatus.ACTIVE);
    });

    it('should have valid status enum values', () => {
      expect(YieldDepositStatus.ACTIVE).toBe('ACTIVE');
      expect(YieldDepositStatus.WITHDRAWN).toBe('WITHDRAWN');
    });
  });

  describe('SavingsCircle Entity', () => {
    it('should instantiate with valid data', () => {
      const circle = new SavingsCircle();
      circle.id = '123e4567-e89b-12d3-a456-426614174000';
      circle.circleId = '0xcircle123';
      circle.name = 'Community Savings';
      circle.members = [
        { memberAddress: '0xmem1', contributionAmount: '1000000' },
      ];
      circle.currentRound = 1;
      circle.payoutSchedule = [
        { round: 1, recipient: '0xrec1', amount: '5000000' },
      ];
      circle.status = SavingsCircleStatus.ACTIVE;
      circle.createdAt = new Date();
      circle.updatedAt = new Date();

      expect(circle.circleId).toBe('0xcircle123');
      expect(circle.currentRound).toBe(1);
      expect(circle.status).toBe(SavingsCircleStatus.ACTIVE);
    });

    it('should have valid status enum values', () => {
      expect(SavingsCircleStatus.ACTIVE).toBe('ACTIVE');
      expect(SavingsCircleStatus.COMPLETED).toBe('COMPLETED');
    });
  });

  describe('RateLock Entity', () => {
    it('should instantiate with valid data', () => {
      const lock = new RateLock();
      lock.id = '123e4567-e89b-12d3-a456-426614174000';
      lock.businessId = 'biz-123';
      lock.lockId = '0xlock123';
      lock.lockedAmount = BigInt('1000000');
      lock.fxRate = 1.05;
      lock.expiryAt = new Date();
      lock.status = RateLockStatus.ACTIVE;
      lock.createdAt = new Date();
      lock.updatedAt = new Date();

      expect(lock.businessId).toBe('biz-123');
      expect(lock.fxRate).toBe(1.05);
      expect(lock.status).toBe(RateLockStatus.ACTIVE);
    });

    it('should have valid status enum values', () => {
      expect(RateLockStatus.ACTIVE).toBe('ACTIVE');
      expect(RateLockStatus.USED).toBe('USED');
      expect(RateLockStatus.EXPIRED).toBe('EXPIRED');
    });
  });

  describe('CrossChainTransfer Entity', () => {
    it('should instantiate with valid data', () => {
      const transfer = new CrossChainTransfer();
      transfer.id = '123e4567-e89b-12d3-a456-426614174000';
      transfer.sourceChain = 'ethereum';
      transfer.receiver = '0x1234567890abcdef';
      transfer.amount = BigInt('1000000');
      transfer.messageId = '0xmessage123';
      transfer.status = CrossChainTransferStatus.PENDING;
      transfer.bridgeProtocol = BridgeProtocol.CCTP;
      transfer.receivedAmount = null;
      transfer.receivedAt = null;
      transfer.failureReason = null;
      transfer.createdAt = new Date();
      transfer.updatedAt = new Date();

      expect(transfer.sourceChain).toBe('ethereum');
      expect(transfer.bridgeProtocol).toBe(BridgeProtocol.CCTP);
      expect(transfer.status).toBe(CrossChainTransferStatus.PENDING);
    });

    it('should have valid status enum values', () => {
      expect(CrossChainTransferStatus.PENDING).toBe('PENDING');
      expect(CrossChainTransferStatus.RECEIVED).toBe('RECEIVED');
      expect(CrossChainTransferStatus.FAILED).toBe('FAILED');
    });

    it('should have valid bridge protocol enum values', () => {
      expect(BridgeProtocol.CCTP).toBe('CCTP');
      expect(BridgeProtocol.WORMHOLE).toBe('WORMHOLE');
    });
  });
});
