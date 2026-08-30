import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { BULK_UPDATE_LIVES_MAX_STUDENTS } from '../../constants/lives-constants';
import { BulkUpdateLivesDto } from './bulk-update-lives.dto';

describe('BulkUpdateLivesDto', () => {
  it('rejects an empty students array', async () => {
    const dto = plainToInstance(BulkUpdateLivesDto, { students: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'students')).toBe(true);
  });

  it('rejects more than BULK_UPDATE_LIVES_MAX_STUDENTS items', async () => {
    const students = Array.from({ length: BULK_UPDATE_LIVES_MAX_STUDENTS + 1 }, (_, i) => ({
      accountId: i + 1,
      delta: 1,
    }));
    const dto = plainToInstance(BulkUpdateLivesDto, { students });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'students')).toBe(true);
  });

  it('accepts a non-empty students array within the size limit', async () => {
    const dto = plainToInstance(BulkUpdateLivesDto, {
      students: [{ accountId: 1, delta: -1 }],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
