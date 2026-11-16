import { ORGANIZATION_LOG_PAGE_SIZE_DEFAULT } from '../constants/organization-log-constants';
import { OrganizationLogController } from './organization-log.controller';
import { OrganizationLogQueryService } from './organization-log-query.service';

describe('OrganizationLogController', () => {
  const listForSessionAdministrator = jest.fn().mockResolvedValue({ items: [] });
  const controller = new OrganizationLogController({
    listForSessionAdministrator,
  } as unknown as OrganizationLogQueryService);

  beforeEach(() => {
    listForSessionAdministrator.mockClear();
  });

  it('asks the query service for the session organization page', async () => {
    await controller.list({} as never, { category: 'group', limit: 20, cursorParts: true });
    expect(listForSessionAdministrator).toHaveBeenCalledWith(
      {},
      {
        category: 'group',
        limit: 20,
        before: null,
        beforeId: null,
        beforeSource: null,
      },
    );
  });

  it('uses the default page size when the query omits it', async () => {
    await controller.list({} as never, { cursorParts: true });
    expect(listForSessionAdministrator).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ limit: ORGANIZATION_LOG_PAGE_SIZE_DEFAULT, category: 'all' }),
    );
  });
});
