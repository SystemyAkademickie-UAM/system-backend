import { SuperAdminBootstrapService } from './super-admin-bootstrap.service';
import { SUPER_ROLE_NAME } from '../../constants/role-name-constants';

describe('SuperAdminBootstrapService', () => {
  const accountRepository = {
    exist: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({ id: 99, ...value })),
  };
  const userRepository = {
    createQueryBuilder: jest.fn(),
  };
  const organizationRepository = {
    findOne: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  const service = new SuperAdminBootstrapService(
    configService as never,
    accountRepository as never,
    userRepository as never,
    organizationRepository as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    accountRepository.exist.mockResolvedValue(false);
    configService.get.mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'SUPERADMIN_BOOTSTRAP_EMAIL') {
        return 'super@localhost.invalid';
      }
      if (key === 'SUPERADMIN_BOOTSTRAP_ORGANIZATION_ID') {
        return defaultValue ?? '';
      }
      return defaultValue ?? '';
    });
    organizationRepository.findOne.mockResolvedValue({ id: 1, isActive: true });
    accountRepository.findOne.mockResolvedValue(null);
    userRepository.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 7 }),
    });
  });

  it('grants super role on login when none exists and email matches env', async () => {
    await service.tryGrantBootstrapSuperOnLogin(7, 'super@localhost.invalid');
    expect(accountRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 7,
        organizationId: 1,
        role: SUPER_ROLE_NAME,
      }),
    );
  });

  it('skips grant when a super account already exists', async () => {
    accountRepository.exist.mockResolvedValue(true);
    await service.tryGrantBootstrapSuperOnLogin(7, 'super@localhost.invalid');
    expect(accountRepository.save).not.toHaveBeenCalled();
  });
});
