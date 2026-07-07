import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Business } from './entities/business.entity';

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
  ) {}

  /**
   * Creates a new business account with a hashed API key.
   * Returns the plaintext key ONCE — it is not stored and cannot be recovered.
   */
  async createApiKey(name: string): Promise<{ business: Business; plaintextKey: string }> {
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    const secret = randomBytes(32).toString('hex');
    const plaintextKey = `cestra_${id}_${secret}`;
    const saltRounds = 10;
    const api_key_hash = await bcrypt.hash(plaintextKey, saltRounds);

    const business = this.businessRepo.create({ id, name, api_key_hash });
    await this.businessRepo.save(business);

    return { business, plaintextKey };
  }

  /**
   * Validates a plaintext API key against all stored bcrypt hashes.
   * Returns the matching Business or null if no match found.
   */
  async validateApiKey(plaintextKey: string): Promise<Business | null> {
    const parts = plaintextKey.split('_');
    if (parts.length === 3 && parts[0] === 'cestra') {
      const id = parts[1];
      const business = await this.businessRepo.findOne({ where: { id } });
      if (business) {
        const match = await bcrypt.compare(plaintextKey, business.api_key_hash);
        if (match) return business;
      }
      return null;
    }

    // Fallback for old keys
    const businesses = await this.businessRepo.find();
    for (const business of businesses) {
      const match = await bcrypt.compare(plaintextKey, business.api_key_hash);
      if (match) {
        return business;
      }
    }
    return null;
  }
}
