import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import {
  BROADCAST_CONTENT_MAX_LENGTH,
  BROADCAST_LEVELS,
  BROADCAST_TARGET_ROLES,
  BROADCAST_TITLE_MAX_LENGTH,
  type BroadcastLevel,
  type BroadcastTargetRole,
} from '../../constants/broadcast-constants';

function trimStringValue({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeOptionalExpiresAt({ value }: { value: unknown }): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value;
}

/**
 * Payload for updating an existing system-wide broadcast announcement.
 */
export class UpdateBroadcastDto {
  @ApiPropertyOptional({ description: 'Announcement title', maxLength: BROADCAST_TITLE_MAX_LENGTH })
  @Transform(trimStringValue)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROADCAST_TITLE_MAX_LENGTH)
  title?: string;
  @ApiPropertyOptional({ description: 'Full announcement body', maxLength: BROADCAST_CONTENT_MAX_LENGTH })
  @Transform(trimStringValue)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROADCAST_CONTENT_MAX_LENGTH)
  content?: string;
  @ApiPropertyOptional({ enum: BROADCAST_LEVELS })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(BROADCAST_LEVELS)
  level?: BroadcastLevel;
  @ApiPropertyOptional({ enum: BROADCAST_TARGET_ROLES })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(BROADCAST_TARGET_ROLES)
  targetRole?: BroadcastTargetRole;
  @ApiPropertyOptional({ description: 'Expiration date in ISO-8601 format', nullable: true })
  @Transform(normalizeOptionalExpiresAt)
  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;
}
