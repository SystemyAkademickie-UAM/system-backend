import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { UserEntity } from '../../database/entities/user.entity';
import type { SamlSessionPayload } from '../saml/saml.types';
import { SamlLinkedUserService } from './saml-linked-user.service';

describe('SamlLinkedUserService', () => {
  let service: SamlLinkedUserService;
  let userRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row: UserEntity) => row),
      save: jest.fn(async (row: UserEntity) => ({ ...row, id: 5 })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SamlLinkedUserService,
        { provide: getRepositoryToken(UserEntity), useValue: userRepository },
      ],
    }).compile();

    service = module.get(SamlLinkedUserService);
  });

  function payload(overrides: Partial<SamlSessionPayload>): SamlSessionPayload {
    return {
      sub: 'user-1',
      email: 'jan@localhost.invalid',
      ...overrides,
    };
  }

  it('stores givenName and sn as whole strings and ignores displayName order', async () => {
    await service.findOrCreateFromSamlSession(payload({
      givenName: 'Paweł',
      surname: 'Nawrocki',
      displayName: 'Nawrocki Paweł',
    }));

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Paweł',
      surname: 'Nawrocki',
    }));
  });

  it('keeps a double given name and a double surname in one field each', async () => {
    await service.findOrCreateFromSamlSession(payload({
      givenName: 'Jan Krzysztof',
      surname: 'Pawłak Kowalski',
      displayName: 'Pawłak Kowalski Jan Krzysztof',
    }));

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jan Krzysztof',
      surname: 'Pawłak Kowalski',
    }));
  });

  it('keeps a hyphenated surname as one string', async () => {
    await service.findOrCreateFromSamlSession(payload({
      givenName: 'Jan Krzysztof',
      surname: 'Pawłak-Kowalski',
      displayName: 'Pawłak-Kowalski Jan Krzysztof',
    }));

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jan Krzysztof',
      surname: 'Pawłak-Kowalski',
    }));
  });

  it('uses a placeholder when givenName or sn is missing', async () => {
    await service.findOrCreateFromSamlSession(payload({
      displayName: 'Jan Kowalski',
    }));

    expect(userRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      name: '-',
      surname: '-',
    }));
  });
});
