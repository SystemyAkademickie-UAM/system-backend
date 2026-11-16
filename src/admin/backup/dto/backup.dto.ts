import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { BACKUP_PASSWORD_MIN_LENGTH } from '../../../constants/backup-constants';
import type { AutoBackupScheduleInterval } from '../backup-response-types';

export const AUTO_BACKUP_INTERVALS: readonly AutoBackupScheduleInterval[] = [
  'daily',
  'every_3_days',
  'weekly',
  'every_2_weeks',
  'custom',
] as const;

export class UpdateAutoBackupScheduleDto {
  @ApiProperty({
    description: 'Czy automatyczne kopie zapasowe mają być włączone',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Przedział czasowy wykonywania kopii',
    enum: AUTO_BACKUP_INTERVALS,
    example: 'daily',
  })
  @IsIn(AUTO_BACKUP_INTERVALS, {
    message: 'interval must be one of: daily, every_3_days, weekly, every_2_weeks, custom',
  })
  interval: AutoBackupScheduleInterval;

  @ApiPropertyOptional({
    description: 'Niestandardowa liczba dni między kopiami (wymagana gdy interval=custom, od 1 do 365)',
    example: 5,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  customIntervalDays?: number;

  @ApiProperty({
    description: 'Godzina uruchomienia kopii zapasowej w formacie HH:mm (24h)',
    example: '02:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'timeOfDay must be in HH:mm 24-hour format (e.g. 02:00)',
  })
  timeOfDay: string;
}

export class ExportBackupDto {
  @ApiProperty({
    description: 'Hasło służące do zaszyfrowania pobieranej kopii zapasowej (min. 8 znaków)',
    example: 'sample-backup-passphrase',
  })
  @IsString()
  @MinLength(BACKUP_PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${BACKUP_PASSWORD_MIN_LENGTH} characters`,
  })
  password: string;
}

export class ImportBackupDto {
  @ApiPropertyOptional({
    description: 'Hasło deszyfrujące dla kopii zapasowej zabezpieczonej hasłem',
    example: 'sample-backup-passphrase',
  })
  @IsOptional()
  @IsString()
  password?: string;
}
