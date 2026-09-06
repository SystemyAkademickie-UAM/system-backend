import { ConsoleLogger } from '@nestjs/common';

import { LogStoreService } from './log-store.service';

/**
 * Nest logger that keeps stdout and appends the same line to the daily log file.
 */
export class ProductionFileLogger extends ConsoleLogger {
  constructor(private readonly logStore: LogStoreService) {
    super();
  }

  override log(message: unknown, ...optionalParams: unknown[]): void {
    super.log(message, ...optionalParams);
    this.writeFile('log', message, optionalParams);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.writeFile('error', message, optionalParams);
  }

  override warn(message: unknown, ...optionalParams: unknown[]): void {
    super.warn(message, ...optionalParams);
    this.writeFile('warn', message, optionalParams);
  }

  override debug(message: unknown, ...optionalParams: unknown[]): void {
    super.debug(message, ...optionalParams);
    this.writeFile('debug', message, optionalParams);
  }

  override verbose(message: unknown, ...optionalParams: unknown[]): void {
    super.verbose(message, ...optionalParams);
    this.writeFile('verbose', message, optionalParams);
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message, ...optionalParams);
    this.writeFile('fatal', message, optionalParams);
  }

  private writeFile(level: string, message: unknown, optionalParams: unknown[]): void {
    const context = this.resolveContext(optionalParams);
    const extras = optionalParams
      .filter((param) => param !== context)
      .map((param) => this.stringify(param))
      .filter((text) => text.length > 0);
    const line =
      extras.length === 0 ? this.stringify(message) : `${this.stringify(message)} ${extras.join(' ')}`;
    this.logStore.appendLine(level, context, line);
  }

  private resolveContext(optionalParams: unknown[]): string {
    if (optionalParams.length === 0) {
      return 'Nest';
    }
    const last = optionalParams[optionalParams.length - 1];
    return typeof last === 'string' ? last : 'Nest';
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.stack ?? message.message;
    }
    return JSON.stringify(message);
  }
}
