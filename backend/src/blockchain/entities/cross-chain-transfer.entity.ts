import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CrossChainTransferStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  FAILED = 'FAILED',
}

export enum BridgeProtocol {
  CCTP = 'CCTP',
  WORMHOLE = 'WORMHOLE',
}

@Entity('cross_chain_transfers')
@Index(['status'])
@Index(['messageId'])
@Index(['receiver'])
@Index(['createdAt'])
export class CrossChainTransfer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  sourceChain: string;

  @Column({ type: 'varchar', length: 255 })
  receiver: string;

  @Column({ type: 'bigint' })
  amount: bigint;

  @Column({ type: 'varchar', length: 255, unique: true })
  messageId: string;

  @Column({ type: 'varchar', length: 50, default: CrossChainTransferStatus.PENDING })
  status: CrossChainTransferStatus;

  @Column({ type: 'varchar', length: 50 })
  bridgeProtocol: BridgeProtocol;

  @Column({ type: 'bigint', nullable: true })
  receivedAmount: bigint | null;

  @Column({ type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  failureReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
