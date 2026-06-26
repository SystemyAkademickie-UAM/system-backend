import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Normalizes Nest validation errors so `message` is a string and `errors` keeps the array form.
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as Record<string, unknown>;
      const message = body.message;

      if (Array.isArray(message)) {
        const errors = message.map((item) => String(item));
        response.status(status).json({
          ...body,
          message: errors.join(', '),
          errors,
        });
        return;
      }
    }

    response.status(status).json(exceptionResponse);
  }
}
