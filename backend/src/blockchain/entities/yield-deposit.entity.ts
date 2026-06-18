import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum YieldDepositStatus {
  ACTIVE = 'ACTIVE',
  WITHDRAWN = 'WITHDRAWN',
}

@Entity('yield_deposits')
@Index(['userId'])
@Index(['vaultId'])
@Index(['status'])
@Index(['createdAt'])
export class YieldDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  vaultId: string;

  @Column({ type: 'bigint' })
  amount: bigint;

  @Column({ type: 'bigint' })
  shares: bigint;

  @Column({ type: 'bigint' })
  accruedValue: bigint;

  @Column({ type: 'varchar', length: 50, default: YieldDepositStatus.ACTIVE })
  status: YieldDepositStatus;

  @Column({ type: 'timestamptz' })
  depositedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  withdrawnAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
