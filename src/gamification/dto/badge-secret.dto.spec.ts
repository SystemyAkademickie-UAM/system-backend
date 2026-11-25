import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBadgeDto } from './create-badge.dto';
import { UpdateBadgeDto } from './update-badge.dto';

describe('Badge DTOs — isSecret', () => {
  it('accepts a boolean isSecret and isPublished on create', async () => {
    const inputDto = plainToInstance(CreateBadgeDto, {
      name: 'Ukryty mistrz',
      icon: '🦉',
      isSecret: true,
      isPublished: true,
    });
    const actualErrors = await validate(inputDto);
    expect(actualErrors).toHaveLength(0);
  });

  it('accepts a create payload without isSecret', async () => {
    const inputDto = plainToInstance(CreateBadgeDto, { name: 'Pierwsze kroki', icon: '🏅' });
    const actualErrors = await validate(inputDto);
    expect(actualErrors).toHaveLength(0);
  });

  it('accepts boolean isSecret values on update', async () => {
    const inputTrue = plainToInstance(UpdateBadgeDto, { isSecret: true });
    const inputFalse = plainToInstance(UpdateBadgeDto, { isSecret: false });
    expect(await validate(inputTrue)).toHaveLength(0);
    expect(await validate(inputFalse)).toHaveLength(0);
  });

  it('rejects a non-boolean isSecret on create', async () => {
    const inputDto = plainToInstance(CreateBadgeDto, { name: 'Ukryty mistrz', icon: '🦉', isSecret: 'yes' });
    const actualErrors = await validate(inputDto);
    expect(actualErrors.map((error) => error.property)).toEqual(['isSecret']);
  });

  it('rejects a non-boolean isSecret on update', async () => {
    const inputDto = plainToInstance(UpdateBadgeDto, { isSecret: 1 });
    const actualErrors = await validate(inputDto);
    expect(actualErrors.map((error) => error.property)).toEqual(['isSecret']);
  });
});
