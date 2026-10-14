import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { EntityNotFoundError, QueryFailedError, TypeORMError } from 'typeorm';

import {
  POSTGRES_DEADLOCK_DETECTED,
  POSTGRES_FOREIGN_KEY_VIOLATION,
  POSTGRES_NOT_NULL_VIOLATION,
  POSTGRES_UNIQUE_VIOLATION,
} from '../../constants/postgres-error-codes';

type DatabaseErrorBody = {
  statusCode: number;
  error: string;
  message: string;
};

/**
 * Maps TypeORM and PostgreSQL failures to a stable JSON body without SQL or driver details.
 */
@Catch(TypeORMError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  catch(exception: TypeORMError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.resolveBody(exception);
    response.status(body.statusCode).json(body);
  }

  private resolveBody(exception: TypeORMError): DatabaseErrorBody {
    if (exception instanceof EntityNotFoundError) {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Record not found.',
      };
    }
    const code = this.readPostgresCode(exception);
    if (code === POSTGRES_UNIQUE_VIOLATION) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'This record already exists.',
      };
    }
    if (code === POSTGRES_DEADLOCK_DETECTED) {
      return {
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'The request could not be completed. Please try again.',
      };
    }
    if (code === POSTGRES_FOREIGN_KEY_VIOLATION || code === POSTGRES_NOT_NULL_VIOLATION) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'This change conflicts with related data.',
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'A database error occurred.',
    };
  }

  private readPostgresCode(exception: TypeORMError): string {
    if (!(exception instanceof QueryFailedError)) {
      return '';
    }
    const driverError = exception.driverError as { code?: unknown };
    return typeof driverError?.code === 'string' ? driverError.code : '';
  }
}
