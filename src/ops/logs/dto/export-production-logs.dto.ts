import { IsOptional, IsString, Matches } from 'class-validator';

import { PRODUCTION_LOG_DATE_PATTERN, PRODUCTION_LOG_TODAY_ALIAS } from '../../../constants/production-log-constants';

/**
 * Superadmin export: ECDH public key (uncompressed P-256, base64) and optional day.
 */
export class ExportProductionLogsDto {
  @IsString()
  clientPublicKey: string;

  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${PRODUCTION_LOG_TODAY_ALIAS}|\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2})$`))
  day?: string;

  @IsOptional()
  @IsString()
  auth?: string;
}
