import { ConfigService } from '@nestjs/config';
import { HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request, Response } from 'express';

import { SuperAdminBootstrapService } from '../../admin/bootstrap/super-admin-bootstrap.service';
import { SessionHmacService } from '../session/session-hmac.service';
import { LoginApiService } from '../login/login-api.service';
import { MagicLinkTokenEntity } from '../../database/entities/magic-link-token.entity';
import { MagicLinkEmailService } from './magic-link-email.service';
import { MagicLinkUserService } from './magic-link-user.service';
import { MagicLinkService } from './magic-link.service';

describe('MagicLinkService', () => {
  let service: MagicLinkService;
  let magicLinkTokenRepository: {
    save: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
  };
  let magicLinkEmailService: { assertSmtpConfigured: jest.Mock; sendMagicLinkEmail: jest.Mock };
  let sessionHmacService: { digestPlainSessionHex: jest.Mock };
  let loginApiService: { establishSession: jest.Mock };
  let magicLinkUserService: {
    resolveEmailMagicLinkTarget: jest.Mock;
    resolveEligibleUserIdForMagicLink: jest.Mock;
  };
  let superAdminBootstrapService: { tryGrantBootstrapSuperOnLogin: jest.Mock };
  let verifyQueryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    returning: jest.Mock;
    execute: jest.Mock;
  };

  const clientOrgId = 12;
  const mockRequest = { headers: {} } as Request;
  const mockResponse = { cookie: jest.fn() } as unknown as Response;

  beforeEach(async () => {
    verifyQueryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({
        raw: [{ email: 'player@example.com', organizationId: clientOrgId }],
      }),
    };
    magicLinkTokenRepository = {
      save: jest.fn(async (row) => row),
      findOne: jest.fn(),
      create: jest.fn((row) => row),
      update: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(verifyQueryBuilder),
    };
    magicLinkEmailService = {
      assertSmtpConfigured: jest.fn(),
      sendMagicLinkEmail: jest.fn(),
    };
    sessionHmacService = {
      digestPlainSessionHex: jest.fn((token: string) => `hmac-${token}`),
    };
    loginApiService = {
      establishSession: jest.fn().mockResolvedValue({ session: 'session-token' }),
    };
    magicLinkUserService = {
      resolveEmailMagicLinkTarget: jest.fn().mockResolvedValue({ userId: 42, organizationId: clientOrgId }),
      resolveEligibleUserIdForMagicLink: jest.fn().mockResolvedValue(42),
    };
    superAdminBootstrapService = {
      tryGrantBootstrapSuperOnLogin: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MagicLinkService,
        {
          provide: getRepositoryToken(MagicLinkTokenEntity),
          useValue: magicLinkTokenRepository,
        },
        { provide: MagicLinkEmailService, useValue: magicLinkEmailService },
        { provide: SessionHmacService, useValue: sessionHmacService },
        { provide: LoginApiService, useValue: loginApiService },
        { provide: MagicLinkUserService, useValue: magicLinkUserService },
        { provide: SuperAdminBootstrapService, useValue: superAdminBootstrapService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string) => {
              const values: Record<string, string> = {
                MAGIC_LINK_VERIFY_BASE_URL: 'http://127.0.0.1:3000/login/magic',
                MAGIC_LINK_EXPIRY_SECONDS: '180',
                MAGIC_LINK_COOLDOWN_SECONDS: '300',
              };
              return values[key] ?? fallback ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get(MagicLinkService);
  });

  it('should send magic link email after resolving organization from email', async () => {
    magicLinkTokenRepository.findOne.mockResolvedValue(null);
    const result = await service.requestMagicLink('player@example.com');
    expect(result.sent).toBe(true);
    expect(magicLinkUserService.resolveEmailMagicLinkTarget).toHaveBeenCalledWith(
      'player@example.com',
      null,
    );
    expect(magicLinkTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'player@example.com', organizationId: clientOrgId }),
    );
  });

  it('should reject request when email is not provisioned', async () => {
    magicLinkUserService.resolveEmailMagicLinkTarget.mockRejectedValue(
      new NotFoundException({ error: 'MAGIC_LINK_ACCOUNT_NOT_REGISTERED' }),
    );
    await expect(
      service.requestMagicLink('unknown@example.com'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(magicLinkEmailService.sendMagicLinkEmail).not.toHaveBeenCalled();
  });

  it('should reject request during cooldown', async () => {
    magicLinkTokenRepository.findOne.mockResolvedValue({
      email: 'player@example.com',
      organizationId: clientOrgId,
      consumedAt: null,
      createdAt: new Date(),
    });
    await expect(
      service.requestMagicLink('player@example.com'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('should mint session on valid verify with organization from token', async () => {
    const result = await service.verifyMagicLink(
      mockRequest,
      mockResponse,
      'plain-token-value-1234567890',
    );
    expect(result.session).toBe('session-token');
    expect(verifyQueryBuilder.returning).toHaveBeenCalledWith(['email', 'organizationId']);
    expect(verifyQueryBuilder.execute).toHaveBeenCalled();
    expect(loginApiService.establishSession).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      expect.objectContaining({
        userId: 42,
        loginMethod: 'magic_link',
        organizationId: clientOrgId,
      }),
    );
  });

  it('should read organization id from PostgreSQL snake_case RETURNING rows', async () => {
    verifyQueryBuilder.execute.mockResolvedValueOnce({
      raw: [{ email: 'player@example.com', organization_id: clientOrgId }],
    });
    await service.verifyMagicLink(mockRequest, mockResponse, 'plain-token-value-1234567890');
    expect(loginApiService.establishSession).toHaveBeenCalledWith(
      mockRequest,
      mockResponse,
      expect.objectContaining({ organizationId: clientOrgId }),
    );
  });

  it('should reject expired or missing token on verify', async () => {
    verifyQueryBuilder.execute.mockResolvedValue({ raw: [] });
    await expect(
      service.verifyMagicLink(mockRequest, mockResponse, 'plain-token-value-1234567890'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('should release token claim when session mint fails', async () => {
    loginApiService.establishSession.mockRejectedValue(new Error('session failed'));
    await expect(
      service.verifyMagicLink(mockRequest, mockResponse, 'plain-token-value-1234567890'),
    ).rejects.toThrow('session failed');
    expect(magicLinkTokenRepository.update).toHaveBeenCalledWith(
      { tokenHmac: 'hmac-plain-token-value-1234567890' },
      { consumedAt: null },
    );
  });

  it('should release token claim when user resolution fails after claim', async () => {
    magicLinkUserService.resolveEligibleUserIdForMagicLink.mockRejectedValue(
      new NotFoundException({ error: 'MAGIC_LINK_ACCOUNT_NOT_REGISTERED' }),
    );
    await expect(
      service.verifyMagicLink(mockRequest, mockResponse, 'plain-token-value-1234567890'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(magicLinkTokenRepository.update).toHaveBeenCalledWith(
      { tokenHmac: 'hmac-plain-token-value-1234567890' },
      { consumedAt: null },
    );
  });
});
