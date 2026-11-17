import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Request } from 'express';

import { AdminAccessService } from '../admin-access.service';
import {
  ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES,
  SERVER_TOTAL_STORAGE_POOL_BYTES,
} from '../../constants/organization-storage-constants';
import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { DriveEntity } from '../../database/entities/drive.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationLogEntity } from '../../database/entities/organization-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AdminOrganizationStorageService } from './admin-organization-storage.service';

describe('AdminOrganizationStorageService', () => {
  let service: AdminOrganizationStorageService;
  let adminAccessService: { resolveAccountDeletionActor: jest.Mock };
  let organizationRepository: { findOne: jest.Mock };
  let accountRepository: { find: jest.Mock };
  let userRepository: { find: jest.Mock };
  let groupRepository: { find: jest.Mock };
  let driveRepository: { find: jest.Mock };
  let organizationLogRepository: { find: jest.Mock };

  const mockReq = {} as Request;
  const mockOrg: OrganizationEntity = {
    id: 1,
    name: 'Wydział Matematyki i Informatyki',
    domain: 'wmi.amu.edu.pl',
    loginMethod: 'saml',
    contactEmail: 'contact@wmi.amu.edu.pl',
    contactPhone: '+48 61 829 0000',
    entityId: null,
    metadataUrl: null,
    ssoLoginUrl: null,
    ssoLogoutUrl: null,
    certificateId: null,
    representativeFullName: 'Jan Kowalski',
    representativeEmail: 'jan@wmi.amu.edu.pl',
    representativePhone: '+48 61 829 0001',
    addressTown: 'Poznań',
    addressStreet: 'ul. Uniwersytetu Poznańskiego',
    addressBuilding: '4',
    addressPostalCode: '61-614',
    addressCountry: 'pl',
    isActive: true,
    createdAt: new Date('2026-10-01T12:00:00.000Z'),
    updatedAt: new Date('2026-10-01T12:00:00.000Z'),
  };

  beforeEach(async () => {
    adminAccessService = {
      resolveAccountDeletionActor: jest.fn().mockResolvedValue({ userId: 1, isSuperAdmin: true }),
    };
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue(mockOrg),
    };
    accountRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    userRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    groupRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    driveRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    organizationLogRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOrganizationStorageService,
        { provide: AdminAccessService, useValue: adminAccessService },
        { provide: getRepositoryToken(OrganizationEntity), useValue: organizationRepository },
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
        { provide: getRepositoryToken(GroupEntity), useValue: groupRepository },
        { provide: getRepositoryToken(DriveEntity), useValue: driveRepository },
        { provide: getRepositoryToken(OrganizationLogEntity), useValue: organizationLogRepository },
      ],
    }).compile();

    service = module.get(AdminOrganizationStorageService);
  });

  describe('getOrganizationDashboard', () => {
    it('throws NotFoundException when organization is missing', async () => {
      organizationRepository.findOne.mockResolvedValue(null);

      await expect(service.getOrganizationDashboard(mockReq, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when organization is inactive', async () => {
      organizationRepository.findOne.mockResolvedValue({ ...mockOrg, isActive: false });

      await expect(service.getOrganizationDashboard(mockReq, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns structured dashboard metrics with account, group and storage counts', async () => {
      accountRepository.find.mockResolvedValue([
        { id: 10, userId: 101, organizationId: 1, role: STUDENT_ROLE_NAME },
        { id: 11, userId: 102, organizationId: 1, role: STUDENT_ROLE_NAME },
        { id: 12, userId: 103, organizationId: 1, role: LECTURER_ROLE_NAME },
        { id: 13, userId: 104, organizationId: 1, role: ADMINISTRATOR_ROLE_NAME },
      ]);

      groupRepository.find.mockResolvedValue([
        { id: 1, imageRef: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
        { id: 2, imageRef: null },
      ]);

      driveRepository.find.mockResolvedValue([
        {
          id: 1,
          ref: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
          size: 2097152, // 2 MiB
          mimeType: 'image/png',
          createdAt: new Date('2026-11-10T12:00:00.000Z'),
          organizationId: 1,
        },
      ]);

      organizationLogRepository.find.mockResolvedValue([
        {
          id: 5,
          occurredAt: new Date('2026-11-15T10:00:00.000Z'),
          category: 'organization',
          kind: 'file_stored',
          actorName: 'Lecturer User',
          fileName: 'banner.png',
          fileSizeBytes: 2097152,
          groupName: 'Matematyka',
        },
      ]);

      const result = await service.getOrganizationDashboard(mockReq, 1);

      expect(adminAccessService.resolveAccountDeletionActor).toHaveBeenCalledWith(mockReq, 1);
      expect(result.organization.name).toBe('Wydział Matematyki i Informatyki');
      expect(result.summary.accounts.total).toBe(4);
      expect(result.summary.accounts.students).toBe(2);
      expect(result.summary.accounts.lecturers).toBe(1);
      expect(result.summary.accounts.administrators).toBe(1);
      expect(result.summary.groups.total).toBe(2);
      expect(result.summary.groups.withBanner).toBe(1);
      expect(result.summary.storage.quotaBytes).toBe(ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES);
      expect(result.summary.storage.serverTotalPoolBytes).toBe(SERVER_TOTAL_STORAGE_POOL_BYTES);
      expect(result.summary.storage.folderPath).toBe('storage/drive/1');
      expect(result.summary.recentActivity).toHaveLength(1);
      expect(result.summary.recentActivity[0].kind).toBe('file_stored');
    });
  });

  describe('getOrganizationStorage', () => {
    it('returns storage inventory mapped to group and lecturer metadata', async () => {
      accountRepository.find.mockResolvedValue([
        { id: 20, userId: 201, organizationId: 1, role: LECTURER_ROLE_NAME },
      ]);
      userRepository.find.mockResolvedValue([
        { id: 201, name: 'Anna', surname: 'Nowak', email: 'anna@amu.edu.pl', nickname: 'anowak' },
      ]);
      driveRepository.find.mockResolvedValue([
        {
          id: 1,
          ref: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          size: 1048576, // 1 MiB
          mimeType: 'image/jpeg',
          createdAt: new Date('2026-11-12T14:00:00.000Z'),
          organizationId: 1,
        },
      ]);
      groupRepository.find.mockResolvedValue([
        {
          id: 5,
          name: 'Geometria Analityczna',
          subjectName: 'Matematyka',
          teacherAccountId: 20,
          imageRef: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
        },
      ]);

      const result = await service.getOrganizationStorage(mockReq, 1);

      expect(result.organizationId).toBe(1);
      expect(result.quotaBytes).toBe(ORGANIZATION_DEFAULT_STORAGE_QUOTA_BYTES);
      expect(result.usedBytes).toBe(1048576);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].groupName).toBe('Geometria Analityczna');
      expect(result.files[0].lecturerName).toBe('Anna Nowak');
      expect(result.files[0].lecturerEmail).toBe('anna@amu.edu.pl');
      expect(result.files[0].downloadUrl).toBe(
        '/api/drive/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d?organizationId=1',
      );
    });
  });
});
