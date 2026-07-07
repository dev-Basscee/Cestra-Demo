import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AuthController (e2e) - Apple Login Bypass', () => {
  let app: INestApplication;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return 401 for apple provider with forged token (without NODE_ENV)', async () => {
    delete process.env.NODE_ENV;
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const forgedToken = Buffer.from(JSON.stringify({ wallet_address: '0x123', provider: 'apple' })).toString('base64');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ zklogin_token: forgedToken, provider: 'apple' })
      .expect(401);
  });

  it('should return 401 for apple provider with forged token (with NODE_ENV=production)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const forgedToken = Buffer.from(JSON.stringify({ wallet_address: '0x123', provider: 'apple' })).toString('base64');

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ zklogin_token: forgedToken, provider: 'apple' })
      .expect(401);
  });
});
