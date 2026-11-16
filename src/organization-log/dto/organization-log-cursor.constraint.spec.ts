import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ListOrganizationLogQueryDto } from './list-organization-log.query';

describe('ListOrganizationLogQueryDto', () => {
  it('accepts a query with no cursor', async () => {
    const dto = plainToInstance(ListOrganizationLogQueryDto, { category: 'all' });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });

  it('rejects a cursor that is missing one part', async () => {
    const dto = plainToInstance(ListOrganizationLogQueryDto, { before: '2026-11-16T19:00:00.000Z' });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'cursorParts')).toBe(true);
  });

  it('accepts a complete cursor', async () => {
    const dto = plainToInstance(ListOrganizationLogQueryDto, {
      before: '2026-11-16T19:00:00.000Z',
      beforeId: 4,
      beforeSource: 'archive',
    });
    const errors = await validate(dto);
    expect(errors).toEqual([]);
  });
});
