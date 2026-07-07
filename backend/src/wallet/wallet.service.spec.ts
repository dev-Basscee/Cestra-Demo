import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Wallet } from './entities/wallet.entity';
import { BridgeAddress } from './entities/bridge-address.entity';
import { Transaction } from '../send/entities/transaction.entity';
import { REDIS_CLIENT } from '../redis/redis.constants';

describe('WalletService', () => {
  let service: WalletService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'NODE_ENV') return 'production';
              return null;
            }),
          },
        },
        { provide: getRepositoryToken(Wallet), useValue: {} },
        { provide: getRepositoryToken(BridgeAddress), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: REDIS_CLIENT, useValue: {} },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should throw ForbiddenException for fundCrosschain in production', async () => {
    await expect(service.fundCrosschain('user1', { source_chain: 'ethereum' } as any))
      .rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException for fundAch in production', async () => {
    await expect(service.fundAch('user1', { amount: 10, plaid_token: 'test' } as any))
      .rejects.toThrow(ForbiddenException);
  });
});
