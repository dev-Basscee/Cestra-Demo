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

@Entity('blacklist')
@Index(['address'])
@Index(['isActive'])
export class Blacklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  address: string;

  @Column({ type: 'text' })
  reason: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'added_by' })
  addedBy: User | null;

  @Column({ type: 'uuid', nullable: true })
  addedById: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  addedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  removedAt: Date | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
