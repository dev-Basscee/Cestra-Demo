import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/auth/entities/user.entity';
import { Repository } from 'typeorm';

describe('WebhookController (e2e) - Persona Signature', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Must enable rawBody for testing as we do in main.ts
    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();

    userRepo = app.get(getRepositoryToken(User));
    
    // Create a test user
    testUser = userRepo.create({
      wallet_address: '0xTestWebhook',
      provider: 'google',
      kyc_tier: 1,
    });
    await userRepo.save(testUser);
  });

  afterAll(async () => {
    if (testUser) {
      await userRepo.delete({ id: testUser.id });
    }
    if (app) {
      await app.close();
    }
  });

  it('should return 401 when missing signature', async () => {
    const payload = {
      data: {
        attributes: {
          status: 'approved',
          reference_id: testUser.id,
        },
      },
    };

    await request(app.getHttpServer())
      .post('/auth/kyc/webhook')
      .send(payload)
      .expect(401);

    const user = await userRepo.findOne({ where: { id: testUser.id } });
    expect(user.kyc_tier).toBe(1); // Not mutated
  });

  it('should return 401 when signature is invalid', async () => {
    const payload = {
      data: {
        attributes: {
          status: 'approved',
          reference_id: testUser.id,
        },
      },
    };

    await request(app.getHttpServer())
      .post('/auth/kyc/webhook')
      .set('persona-signature', 'deadbeef')
      .send(payload)
      .expect(401);

    const user = await userRepo.findOne({ where: { id: testUser.id } });
    expect(user.kyc_tier).toBe(1); // Not mutated
  });
});
