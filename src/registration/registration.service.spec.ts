import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { RegistrationService } from './registration.service';

describe('RegistrationService', () => {
  let service: RegistrationService;
  let userRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let avatarRepository: {
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(async (user) => user),
    };
    avatarRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(AvatarEntity),
          useValue: avatarRepository,
        },
      ],
    }).compile();

    service = module.get(RegistrationService);
  });

  it('returns profileSubmitted flag from profileSubmittedAt', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 7,
      email: 'user@test.local',
      nickname: 'Nick',
      avatarId: 2,
      registrationCompleted: false,
      eulaAcceptedAt: null,
      profileSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(service.getRegistrationStatus(7)).resolves.toEqual({
      userId: 7,
      email: 'user@test.local',
      nickname: 'Nick',
      avatarId: 2,
      registrationCompleted: false,
      eulaAccepted: false,
      profileSubmitted: true,
    });
  });

  it('sets profileSubmittedAt when profile is saved', async () => {
    const user = {
      id: 7,
      email: 'user@test.local',
      nickname: '',
      avatarId: 1,
      profileSubmittedAt: null,
    };
    userRepository.findOne.mockResolvedValue(user);
    avatarRepository.findOne.mockResolvedValue({ id: 3 });

    await service.updateProfile(7, ' MegaKrolik ', 3);

    expect(user.nickname).toBe('MegaKrolik');
    expect(user.avatarId).toBe(3);
    expect(user.profileSubmittedAt).toBeInstanceOf(Date);
    expect(userRepository.save).toHaveBeenCalledWith(user);
  });

  it('rejects empty nickname', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 7,
      nickname: '',
      avatarId: 1,
      profileSubmittedAt: null,
    });

    await expect(service.updateProfile(7, '   ', 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown avatar id', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 7,
      nickname: '',
      avatarId: 1,
      profileSubmittedAt: null,
    });
    avatarRepository.findOne.mockResolvedValue(null);

    await expect(service.updateProfile(7, 'Nick', 99)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts EULA when profile was submitted', async () => {
    const user = {
      id: 7,
      nickname: 'Nick',
      avatarId: 2,
      registrationCompleted: false,
      eulaAcceptedAt: null,
      profileSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    userRepository.findOne.mockResolvedValue(user);

    await service.acceptEula(7);

    expect(user.registrationCompleted).toBe(true);
    expect(user.eulaAcceptedAt).toBeInstanceOf(Date);
  });

  it('rejects EULA when profile was not submitted', async () => {
    userRepository.findOne.mockResolvedValue({
      id: 7,
      nickname: '',
      avatarId: 2,
      registrationCompleted: false,
      eulaAcceptedAt: null,
      profileSubmittedAt: null,
    });

    await expect(service.acceptEula(7)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when user is missing', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(service.getRegistrationStatus(99)).rejects.toBeInstanceOf(NotFoundException);
  });
});
