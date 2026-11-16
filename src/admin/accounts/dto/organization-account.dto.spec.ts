import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ImportOrganizationAccountsDto } from './organization-account.dto';

describe('ImportOrganizationAccountsDto', () => {
  it('rejects a row that names an account id or a user id', async () => {
    const dto = plainToInstance(ImportOrganizationAccountsDto, {
      users: [{
        accountId: 2,
        userId: 4,
        email: 'ada@example.com',
        name: 'Ada',
        surname: 'Local',
        role: 'student',
      }],
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    const childErrors = errors.flatMap((error) => error.children ?? []).flatMap((child) => child.children ?? []);
    const rejected = childErrors.map((error) => error.property);
    expect(rejected).toEqual(expect.arrayContaining(['accountId', 'userId']));
  });
});
