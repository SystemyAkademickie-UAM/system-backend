import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PRODUCTION_LOG_CLIENT_MESSAGE_MAX_CHARS } from '../../../constants/production-log-constants';

/**
 * Browser error/warn line forwarded into the same daily production log.
 */
export class IngestClientLogDto {
  @IsIn(['error', 'warn'])
  level: 'error' | 'warn';

  @IsString()
  @MaxLength(PRODUCTION_LOG_CLIENT_MESSAGE_MAX_CHARS)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(PRODUCTION_LOG_CLIENT_MESSAGE_MAX_CHARS)
  source?: string;
}
