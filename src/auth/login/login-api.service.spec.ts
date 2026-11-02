import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

import { LoginApiService } from './login-api.service';

describe('LoginApiService.setActiveRole', () => {
  const req = {} as Request;
  let listMemberships: jest.Mock;
  let setActiveRole: jest.Mock;
  let service: LoginApiService;

  beforeEach(() => {
    listMemberships = jest.fn().mockResolvedValue([
      { organizationId: 1, name: 'Internal', roles: ['super'] },
      { organizationId: 2, name: 'Localhost IdP', roles: ['lecturer'] },
    ]);
    setActiveRole = jest.fn();
    service = new LoginApiService(
      {
        resolveSubjectFromRequest: jest.fn().mockResolvedValue({
          userId: 7,
          organizationId: 2,
          activeRole: 'lecturer',
        }),
        extractSessionToken: jest.fn().mockReturnValue('session-token'),
      } as never,
      { setActiveRole } as never,
      {} as never,
      { listMemberships } as never,
      {} as never,
    );
  });

  it('rejects a role held only in another organization', async () => {
    await expect(service.setActiveRole(req, 'super')).rejects.toBeInstanceOf(BadRequestException);
    expect(setActiveRole).not.toHaveBeenCalled();
  });
});
