import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { IsNull, Repository } from 'typeorm';

import { SuperAdminBootstrapService } from '../../admin/bootstrap/super-admin-bootstrap.service';
import { SessionHmacService } from '../session/session-hmac.service';
import { LoginApiService } from '../login/login-api.service';
import {
  MAGIC_LINK_COOLDOWN_DEFAULT_SECONDS,
  MAGIC_LINK_COOLDOWN_SECONDS_ENV_KEY,
  MAGIC_LINK_EXPIRY_DEFAULT_SECONDS,
  MAGIC_LINK_EXPIRY_SECONDS_ENV_KEY,
  MAGIC_LINK_SENT_MESSAGE,
  MAGIC_LINK_TOKEN_RANDOM_BYTE_LENGTH,
  MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY,
} from '../../constants/magic-link-constants';
import { SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY } from '../../constants/super-admin-bootstrap-constants';
import { MagicLinkTokenEntity } from '../../database/entities/magic-link-token.entity';
import { MagicLinkEmailService } from './magic-link-email.service';
import { MagicLinkUserService } from './magic-link-user.service';

export type RequestMagicLinkResponse = {
  sent: true;
  message: string;
};

type MagicLinkClaimRow = {
  email: string;
  organizationId?: number | string;
  organization_id?: number | string;
};

function readClaimedOrganizationId(row: MagicLinkClaimRow): number {
  const rawOrganizationId = row.organizationId ?? row.organization_id;
  const organizationId = Number(rawOrganizationId);
  if (!Number.isFinite(organizationId)) {
    throw new UnauthorizedException({
      error: 'MAGIC_LINK_INVALID',
      message: 'Login link is invalid or has expired.',
    });
  }
  return organizationId;
}

/**
 * Issues, validates, and consumes one-time email magic link tokens.
 */
@Injectable()
export class MagicLinkService {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionHmacService: SessionHmacService,
    private readonly loginApiService: LoginApiService,
    private readonly magicLinkEmailService: MagicLinkEmailService,
    private readonly magicLinkUserService: MagicLinkUserService,
    private readonly superAdminBootstrapService: SuperAdminBootstrapService,
    @InjectRepository(MagicLinkTokenEntity)
    private readonly magicLinkTokenRepository: Repository<MagicLinkTokenEntity>) {}

  async requestMagicLink(
    emailRaw: string,
    organizationId?: number,
  ): Promise<RequestMagicLinkResponse> {
    this.magicLinkEmailService.assertSmtpConfigured();
    await this.assertMagicLinkRoutingConfigured();
    const email = emailRaw.trim().toLowerCase();
    const bootstrapEmail = this.readBootstrapEmail();
    const target =
      organizationId !== undefined && Number.isFinite(organizationId) && organizationId > 0
        ? await this.magicLinkUserService.resolveEmailMagicLinkTargetForOrganization(
            email,
            organizationId,
            bootstrapEmail,
          )
        : await this.magicLinkUserService.resolveEmailMagicLinkTarget(email, bootstrapEmail);
    await this.assertCooldownAllowsRequest(email, target.organizationId);
    const expirySeconds = this.resolveExpirySeconds();
    const plaintext = randomBytes(MAGIC_LINK_TOKEN_RANDOM_BYTE_LENGTH).toString('base64url');
    const tokenHmac = this.sessionHmacService.digestPlainSessionHex(plaintext);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expirySeconds * 1000);
    await this.magicLinkTokenRepository.save(
      this.magicLinkTokenRepository.create({
        email,
        organizationId: target.organizationId,
        tokenHmac,
        expiresAt,
        consumedAt: null,
        createdAt: now,
      }));
    const verifyUrl = this.buildVerifyUrl(plaintext);
    this.magicLinkEmailService.sendMagicLinkEmail(email, verifyUrl);
    return {
      sent: true,
      message: MAGIC_LINK_SENT_MESSAGE,
    };
  }

  async verifyMagicLink(
    req: Request,
    res: Response,
    tokenPlaintext: string): Promise<{ session: string }> {
    const normalizedToken = tokenPlaintext.trim();
    if (normalizedToken === '') {
      throw new BadRequestException('Token is required');
    }
    const tokenHmac = this.sessionHmacService.digestPlainSessionHex(normalizedToken);
    let tokenClaimed = false;
    try {
      const claim = await this.magicLinkTokenRepository
        .createQueryBuilder()
        .update(MagicLinkTokenEntity)
        .set({ consumedAt: new Date() })
        .where('token_hmac = :tokenHmac', { tokenHmac })
        .andWhere('consumed_at IS NULL')
        .andWhere('expires_at > :now', { now: new Date() })
        // TypeORM RETURNING requires entity property names, not DB column names.
        .returning(['email', 'organizationId'])
        .execute();
      const row = claim.raw[0] as MagicLinkClaimRow | undefined;
      if (row === undefined) {
        throw new UnauthorizedException({
          error: 'MAGIC_LINK_INVALID',
          message: 'Login link is invalid or has expired.',
        });
      }
      tokenClaimed = true;
      const organizationId = readClaimedOrganizationId(row);
      const userId = await this.magicLinkUserService.resolveEligibleUserIdForMagicLink(
        row.email,
        organizationId,
        this.readBootstrapEmail());
      await this.superAdminBootstrapService.tryGrantBootstrapSuperOnLogin(userId, row.email);
      return await this.loginApiService.establishSession(req, res, {
        userId,
        loginMethod: 'magic_link',
        organizationId,
      });
    } catch (err: unknown) {
      if (tokenClaimed) {
        await this.magicLinkTokenRepository.update({ tokenHmac }, { consumedAt: null });
      }
      throw err;
    }
  }

  private readBootstrapEmail(): string | null {
    const raw = this.configService.get<string>(SUPERADMIN_BOOTSTRAP_EMAIL_ENV_KEY, '').trim().toLowerCase();
    if (raw === '') {
      return null;
    }
    return raw;
  }

  private async assertCooldownAllowsRequest(email: string, organizationId: number): Promise<void> {
    const cooldownSeconds = this.resolveCooldownSeconds();
    const latest = await this.magicLinkTokenRepository.findOne({
      where: { email, organizationId },
      order: { createdAt: 'DESC' },
    });
    if (latest === null || latest.consumedAt !== null) {
      return;
    }
    const cooldownEndsAt = latest.createdAt.getTime() + cooldownSeconds * 1000;
    const remainingMs = cooldownEndsAt - Date.now();
    if (remainingMs <= 0) {
      return;
    }
    const retryAfterSeconds = Math.ceil(remainingMs / 1000);
    throw new HttpException(
      {
        error: 'MAGIC_LINK_COOLDOWN',
        message: 'A login link was already sent. Please wait before requesting another.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS);
  }

  private buildVerifyUrl(tokenPlaintext: string): string {
    const baseUrl = this.configService.get<string>(MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY, '').trim();
    if (baseUrl === '') {
      throw new Error(`${MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY} is not configured`);
    }
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}token=${encodeURIComponent(tokenPlaintext)}`;
  }

  private async assertMagicLinkRoutingConfigured(): Promise<void> {
    const baseUrl = this.configService.get<string>(MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY, '').trim();
    if (baseUrl === '') {
      throw new ServiceUnavailableException({
        error: 'MAGIC_LINK_NOT_CONFIGURED',
        message: `${MAGIC_LINK_VERIFY_BASE_URL_ENV_KEY} is not configured`,
      });
    }
  }

  private resolveExpirySeconds(): number {
    return this.resolvePositiveIntEnv(
      MAGIC_LINK_EXPIRY_SECONDS_ENV_KEY,
      MAGIC_LINK_EXPIRY_DEFAULT_SECONDS);
  }

  private resolveCooldownSeconds(): number {
    return this.resolvePositiveIntEnv(
      MAGIC_LINK_COOLDOWN_SECONDS_ENV_KEY,
      MAGIC_LINK_COOLDOWN_DEFAULT_SECONDS);
  }

  private resolvePositiveIntEnv(envKey: string, fallbackSeconds: number): number {
    const raw = this.configService.get<string>(envKey, '').trim();
    if (raw === '') {
      return fallbackSeconds;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallbackSeconds;
    }
    return parsed;
  }
}
