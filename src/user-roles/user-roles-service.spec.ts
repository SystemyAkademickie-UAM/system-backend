import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
  SUPER_ROLE_NAME,
} from '../constants/role-name-constants';
import { AccountEntity } from '../database/entities/account.entity';
import { UserRolesService } from './user-roles-service';

describe('UserRolesService', () => {
  let service: UserRolesService;
  let accountRepository: jest.Mocked<Pick<Repository<AccountEntity>, 'find' | 'findOne'>>;

  beforeEach(async () => {
    accountRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Pick<Repository<AccountEntity>, 'find' | 'findOne'>>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UserRolesService,
        { provide: getRepositoryToken(AccountEntity), useValue: accountRepository },
      ],
    }).compile();

    service = moduleRef.get(UserRolesService);
  });

  describe('listRolesForUser', () => {
    it('returns roles ordered from highest to lowest privilege and de-duplicates', async () => {
      accountRepository.find.mockResolvedValue([
        { role: STUDENT_ROLE_NAME },
        { role: SUPER_ROLE_NAME },
        { role: STUDENT_ROLE_NAME },
        { role: LECTURER_ROLE_NAME },
      ] as AccountEntity[]);

      const roles = await service.listRolesForUser(1);

      expect(roles).toEqual([SUPER_ROLE_NAME, LECTURER_ROLE_NAME, STUDENT_ROLE_NAME]);
    });

    it('returns an empty array when the user has no accounts', async () => {
      accountRepository.find.mockResolvedValue([]);

      const roles = await service.listRolesForUser(1);

      expect(roles).toEqual([]);
    });

    it('appends unknown roles after the known priority roles', async () => {
      accountRepository.find.mockResolvedValue([
        { role: 'guest' },
        { role: ADMINISTRATOR_ROLE_NAME },
      ] as AccountEntity[]);

      const roles = await service.listRolesForUser(1);

      expect(roles).toEqual([ADMINISTRATOR_ROLE_NAME, 'guest']);
    });
  });

  describe('resolvePrimaryRoleForUser', () => {
    it('returns the highest-privilege role', async () => {
      accountRepository.find.mockResolvedValue([
        { role: STUDENT_ROLE_NAME },
        { role: ADMINISTRATOR_ROLE_NAME },
      ] as AccountEntity[]);

      const role = await service.resolvePrimaryRoleForUser(1);

      expect(role).toBe(ADMINISTRATOR_ROLE_NAME);
    });

    it('returns null when the user has no roles', async () => {
      accountRepository.find.mockResolvedValue([]);

      const role = await service.resolvePrimaryRoleForUser(1);

      expect(role).toBeNull();
    });
  });
});
