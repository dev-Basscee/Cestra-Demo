import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SendController } from './send.controller';
import { SendService } from './send.service';
import { Transaction } from './entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Recipient } from '../recipients/entities/recipient.entity';
import { WalletModule } from '../wallet/wallet.module';
import { SuiModule } from '../sui/sui.module';
import { User } from '../auth/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Wallet, Recipient, User]),
    WalletModule,
    SuiModule,
  ],
  controllers: [SendController],
  providers: [SendService],
  exports: [SendService],
})
export class SendModule {}
