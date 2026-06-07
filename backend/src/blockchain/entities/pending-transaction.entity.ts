import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PendingTransactionStatus {
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

@Entity('pending_transactions')
@Index(['status'])
@Index(['txDigest'])
@Index(['sender'])
@Index(['createdAt'])
@Index(['idempotencyKey'])
export class PendingTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  txDigest: string | null;

  @Column({ type: 'varchar', length: 255 })
  sender: string;

  @Column({ type: 'varchar', length: 255 })
  function: string;

  @Column({ type: 'jsonb' })
  arguments: Record<string, any>;

  @Column({ type: 'varchar', length: 50, default: PendingTransactionStatus.SUBMITTED })
  status: PendingTransactionStatus;

  @Column({ type: 'varchar', length: 255, unique: true })
  idempotencyKey: string;

  @Column({ type: 'text' })
  signedTxBytes: string;

  @Column({ type: 'smallint', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastRetryAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
