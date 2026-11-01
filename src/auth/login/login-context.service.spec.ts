import { BadRequestException } from '@nestjs/common';

import { UserEntity } from '../../database/entities/user.entity';
import { SessionIssuanceService } from '../session/session-issuance.service';
import { LoginContextService } from './login-context.service';

function membershipRows(
  pairs: { organizationId: number; name: string; role: string }[],
): { organizationId: number; name: string; role: string }[] {
  return pairs;
}

describe('LoginContextService', () => {
  const sessionToken = 'session-token';
  let rows: { organizationId: number; name: string; role: string }[];
  let user: Pick<UserEntity, 'id' | 'lastOrganizationId' | 'lastRole'> | null;
  let setLoginContext: jest.Mock;
  let userUpdate: jest.Mock;
  let service: LoginContextService;

  beforeEach(() => {
    rows = [];
    user = { id: 7, lastOrganizationId: null, lastRole: null };
    setLoginContext = jest.fn().mockResolvedValue(undefined);
    userUpdate = jest.fn().mockResolvedValue(undefined);
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(async () => rows),
    };
    const accountRepository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    const userRepository = {
      findOne: jest.fn(async () => user),
      update: userUpdate,
    };
    service = new LoginContextService(
      accountRepository as never,
      userRepository as never,
      { setLoginContext } as unknown as SessionIssuanceService,
    );
  });

  it('applies a remembered organization and role without asking again', async () => {
    rows = membershipRows([
      { organizationId: 1, name: 'Internal', role: 'super' },
      { organizationId: 2, name: 'Localhost IdP', role: 'lecturer' },
    ]);
    user = { id: 7, lastOrganizationId: 2, lastRole: 'lecturer' };

    await service.applyOnLogin(sessionToken, 7, 1);

    expect(setLoginContext).toHaveBeenCalledWith(sessionToken, 2, 'lecturer');
    expect(userUpdate).not.toHaveBeenCalled();
    await expect(service.describe(7, 2, 'lecturer')).resolves.toEqual({
      memberships: [
        { organizationId: 1, name: 'Internal', roles: ['super'] },
        { organizationId: 2, name: 'Localhost IdP', roles: ['lecturer'] },
      ],
      selectionRequired: false,
    });
  });

  it('stores the only available pair and skips the picker', async () => {
    rows = membershipRows([{ organizationId: 2, name: 'Localhost IdP', role: 'student' }]);

    await service.applyOnLogin(sessionToken, 7, null);

    expect(setLoginContext).toHaveBeenCalledWith(sessionToken, 2, 'student');
    expect(userUpdate).toHaveBeenCalledWith(
      { id: 7 },
      { lastOrganizationId: 2, lastRole: 'student' },
    );
    await expect(service.describe(7, 2, 'student')).resolves.toMatchObject({
      selectionRequired: false,
    });
  });

  it('asks again when several pairs exist and none is remembered', async () => {
    rows = membershipRows([
      { organizationId: 1, name: 'Internal', role: 'super' },
      { organizationId: 2, name: 'Localhost IdP', role: 'lecturer' },
      { organizationId: 2, name: 'Localhost IdP', role: 'student' },
    ]);

    await service.applyOnLogin(sessionToken, 7, 2);

    expect(setLoginContext).toHaveBeenCalledWith(sessionToken, 2, null);
    expect(userUpdate).not.toHaveBeenCalled();
    const described = await service.describe(7, 2, null);
    expect(described.selectionRequired).toBe(true);
    expect(described.memberships[1].roles).toEqual(['lecturer', 'student']);
  });

  it('asks again when the remembered pair is no longer assigned', async () => {
    rows = membershipRows([
      { organizationId: 1, name: 'Internal', role: 'super' },
      { organizationId: 2, name: 'Localhost IdP', role: 'lecturer' },
    ]);
    user = { id: 7, lastOrganizationId: 9, lastRole: 'student' };

    await service.applyOnLogin(sessionToken, 7, 1);

    expect(setLoginContext).toHaveBeenCalledWith(sessionToken, 1, 'super');
    expect(userUpdate).not.toHaveBeenCalled();
    await expect(service.describe(7, 1, 'super')).resolves.toMatchObject({
      selectionRequired: true,
    });
  });

  it('rejects a role the user does not hold in the organization', async () => {
    rows = membershipRows([{ organizationId: 2, name: 'Localhost IdP', role: 'lecturer' }]);

    await expect(service.select(sessionToken, 7, 2, 'student')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(setLoginContext).not.toHaveBeenCalled();
  });

  it('remembers a confirmed pair', async () => {
    rows = membershipRows([
      { organizationId: 1, name: 'Internal', role: 'super' },
      { organizationId: 2, name: 'Localhost IdP', role: 'lecturer' },
    ]);

    await service.select(sessionToken, 7, 1, 'super');

    expect(setLoginContext).toHaveBeenCalledWith(sessionToken, 1, 'super');
    expect(userUpdate).toHaveBeenCalledWith(
      { id: 7 },
      { lastOrganizationId: 1, lastRole: 'super' },
    );
  });
});
