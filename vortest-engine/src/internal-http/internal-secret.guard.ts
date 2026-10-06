// src/internal-http/internal-secret.guard.ts
// Verifica el header X-Internal-Secret contra ENGINE_INTERNAL_SECRET.
// SEG-09: comparación en tiempo constante para evitar ataques de timing.
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'

@Injectable()
export class InternalSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>()
    const secret = request.headers['x-internal-secret']
    const expected = this.config.getOrThrow<string>('ENGINE_INTERNAL_SECRET')

    if (typeof secret !== 'string') {
      throw new UnauthorizedException()
    }
    const a = Buffer.from(secret)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException()
    }
    return true
  }
}
