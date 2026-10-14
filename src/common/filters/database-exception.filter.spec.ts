import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

import { DatabaseExceptionFilter } from './database-exception.filter';

function captureResponse(): { host: ArgumentsHost; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
    }),
  } as ArgumentsHost;
  return { host, status, json };
}

function queryFailed(code: string, query = 'INSERT INTO secret'): QueryFailedError {
  return new QueryFailedError(query, [], { code } as unknown as Error);
}

describe('DatabaseExceptionFilter', () => {
  const filter = new DatabaseExceptionFilter();

  it('maps a unique violation to 409 without the SQL text', () => {
    const captured = captureResponse();
    filter.catch(queryFailed('23505'), captured.host);
    expect(captured.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(captured.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      message: 'This record already exists.',
    });
    expect(JSON.stringify(captured.json.mock.calls[0][0])).not.toContain('INSERT');
  });

  it('maps a foreign-key violation to 400', () => {
    const captured = captureResponse();
    filter.catch(queryFailed('23503'), captured.host);
    expect(captured.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });

  it('maps a missing entity to 404', () => {
    const captured = captureResponse();
    filter.catch(new EntityNotFoundError('Item', { id: 1 }), captured.host);
    expect(captured.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(JSON.stringify(captured.json.mock.calls[0][0])).not.toContain('Item');
  });

  it('maps a deadlock to 409', () => {
    const captured = captureResponse();
    filter.catch(queryFailed('40P01'), captured.host);
    expect(captured.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
  });

  it('keeps an unknown database failure as 500', () => {
    const captured = captureResponse();
    filter.catch(queryFailed('42601'), captured.host);
    expect(captured.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
