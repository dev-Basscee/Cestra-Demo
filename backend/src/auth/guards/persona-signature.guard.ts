import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, RawBodyRequest } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PersonaSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    
    const signatureHeader = req.headers['persona-signature'];
    if (!signatureHeader || typeof signatureHeader !== 'string') {
      throw new UnauthorizedException('Missing Persona-Signature header');
    }

    const secret = this.configService.get<string>('PERSONA_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('PERSONA_WEBHOOK_SECRET not configured');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new UnauthorizedException('Raw request body missing');
    }

    try {
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const provided = Buffer.from(signatureHeader, 'hex');
      const expectedBuf = Buffer.from(expected, 'hex');

      if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
        throw new UnauthorizedException('Invalid Persona signature');
      }
    } catch (e) {
      throw new UnauthorizedException('Invalid Persona signature');
    }

    return true;
  }
}
