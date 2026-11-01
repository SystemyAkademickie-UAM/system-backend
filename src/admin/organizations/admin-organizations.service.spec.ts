import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AdminOrganizationsService } from './admin-organizations.service';
import { AdminAccessService } from '../admin-access.service';
import { IdpCertificateEntity } from '../../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { ORGANIZATION_LOGIN_METHOD_EMAIL } from '../../constants/organization-constants';
import type { CreateOrganizationDto } from './dto/admin-organization.dto';

function organizationRow(id: number, name: string, domain: string): OrganizationEntity {
  return {
    id,
    name,
    loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
    domain,
    representativeFullName: `${name} Contact`,
    representativeEmail: `it@${domain}`,
    representativePhone: null,
    addressTown: 'Poznań',
    addressStreet: 'ul. Wieniawskiego',
    addressBuilding: '1',
    addressPostalCode: '61-712',
    addressCountry: 'PL',
    contactEmail: `it@${domain}`,
    contactPhone: null,
    entityId: null,
    metadataUrl: null,
    ssoLoginUrl: null,
    ssoLogoutUrl: null,
    certificateId: null,
    isActive: true,
    createdAt: new Date('2026-11-01T17:00:00.000Z'),
    updatedAt: new Date('2026-11-01T17:00:00.000Z'),
  } as OrganizationEntity;
}

describe('AdminOrganizationsService', () => {
  let service: AdminOrganizationsService;
  let organizationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    findOneOrFail: jest.Mock;
  };

  const req = {} as Request;
  const profile = {
    representative: {
      fullName: 'Anna Nowak',
      email: 'it-helpdesk@amu.edu.pl',
      phone: '+48 61 829 4000',
    },
    address: {
      town: 'Poznań',
      street: 'ul. Wieniawskiego',
      building: '1',
      postalCode: '61-712',
      country: 'pl',
    },
  };

  beforeEach(async () => {
    organizationRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({
        ...value,
        id: 11,
        createdAt: new Date('2026-11-01T17:00:00.000Z'),
        updatedAt: new Date('2026-11-01T17:00:00.000Z'),
      })),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn(),
    };
    organizationRepository.findOneOrFail.mockImplementation(async () => organizationRepository.save.mock.results.at(-1)?.value);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationsService,
        { provide: AdminAccessService, useValue: { assertSuperAdmin: jest.fn().mockResolvedValue(undefined) } },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(IdpCertificateEntity), useValue: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn(), create: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    service = module.get(AdminOrganizationsService);
  });

  it('stores domain, address, and representative on create', async () => {
    const dto: CreateOrganizationDto = {
      name: 'Uniwersytet im. Adama Mickiewicza w Poznaniu',
      domain: 'AMU.edu.pl',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      ...profile,
    };

    const created = await service.createOrganization(req, dto);

    expect(organizationRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'amu.edu.pl',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      representativeFullName: 'Anna Nowak',
      representativeEmail: 'it-helpdesk@amu.edu.pl',
      representativePhone: '+48 61 829 4000',
      addressTown: 'Poznań',
      addressStreet: 'ul. Wieniawskiego',
      addressBuilding: '1',
      addressPostalCode: '61-712',
      addressCountry: 'PL',
      contactEmail: 'it-helpdesk@amu.edu.pl',
    }));
    expect(created.domain).toBe('amu.edu.pl');
    expect(created.representative.fullName).toBe('Anna Nowak');
    expect(created.address.town).toBe('Poznań');
    expect(created.address.country).toBe('PL');
  });

  it('lists id, name, isActive, and domain', async () => {
    organizationRepository.find.mockResolvedValue([
      organizationRow(2, 'Local', 'localhost'),
      organizationRow(11, 'AMU', 'amu.edu.pl'),
    ]);

    const actual = await service.listOrganizations(req);

    expect(actual).toEqual([
      { id: 2, name: 'Local', isActive: true, domain: 'localhost' },
      { id: 11, name: 'AMU', isActive: true, domain: 'amu.edu.pl' },
    ]);
  });

  it('stores localhost and a local address', async () => {
    const dto: CreateOrganizationDto = {
      name: 'Local',
      domain: '192.168.0.15',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      ...profile,
    };

    const created = await service.createOrganization(req, dto);

    expect(created.domain).toBe('192.168.0.15');
  });

  it('rejects an address outside localhost, 127.0.0.1, and 192.168.0.x', async () => {
    const dto: CreateOrganizationDto = {
      name: 'Other',
      domain: '192.168.1.5',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      ...profile,
    };

    await expect(service.createOrganization(req, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects SAML create without metadata or the manual IdP fields', async () => {
    const dto: CreateOrganizationDto = {
      name: 'Uniwersytet im. Adama Mickiewicza w Poznaniu',
      domain: 'amu.edu.pl',
      loginMethod: 'saml',
      ...profile,
    };

    await expect(service.createOrganization(req, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(organizationRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a domain that is already stored', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 4 });
    const dto: CreateOrganizationDto = {
      name: 'Other',
      domain: 'amu.edu.pl',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      ...profile,
    };

    await expect(service.createOrganization(req, dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns every stored field for the requested organization ids', async () => {
    const first = organizationRow(11, 'AMU', 'amu.edu.pl');
    const second = organizationRow(12, 'UWr', 'uwr.edu.pl');
    organizationRepository.find.mockResolvedValue([second, first]);

    const result = await service.bulkOrganizations(req, { ids: [11, 12, 11] });

    expect(result.organizations.map((organization) => organization.id)).toEqual([11, 12]);
    expect(result.organizations[0]).toEqual(expect.objectContaining({
      name: 'AMU',
      domain: 'amu.edu.pl',
      loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      representative: expect.objectContaining({
        fullName: 'AMU Contact',
        email: 'it@amu.edu.pl',
      }),
      address: expect.objectContaining({
        town: 'Poznań',
        street: 'ul. Wieniawskiego',
        country: 'PL',
      }),
      entityId: null,
      metadataUrl: null,
      certificateId: null,
    }));
    expect(result.organizations[1].domain).toBe('uwr.edu.pl');
  });

  it('reports organization ids that are not stored', async () => {
    organizationRepository.find.mockResolvedValue([organizationRow(11, 'AMU', 'amu.edu.pl')]);

    try {
      await service.bulkOrganizations(req, { ids: [11, 99] });
      throw new Error('expected NotFoundException');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({
        statusCode: 404,
        message: 'Organizations not found',
        error: 'Not Found',
        missingIds: [99],
      });
    }
  });
});
