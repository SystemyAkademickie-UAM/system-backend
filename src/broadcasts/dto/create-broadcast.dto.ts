import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  BROADCAST_CONTENT_MAX_LENGTH,
  BROADCAST_LEVELS,
  BROADCAST_TARGET_ROLES,
  BROADCAST_TITLE_MAX_LENGTH,
  type BroadcastLevel,
  type BroadcastTargetRole,
} from '../../constants/broadcast-constants';

/**
 * Payload for creating a new system-wide broadcast announcement.
 */
export class CreateBroadcastDto {
  @ApiProperty({ description: 'Announcement title', maxLength: BROADCAST_TITLE_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROADCAST_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty({ description: 'Full announcement body', maxLength: BROADCAST_CONTENT_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(BROADCAST_CONTENT_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({ enum: BROADCAST_LEVELS, default: 'info' })
  @IsOptional()
  @IsIn(BROADCAST_LEVELS)
  level?: BroadcastLevel;

  @ApiPropertyOptional({ enum: BROADCAST_TARGET_ROLES, default: 'all' })
  @IsOptional()
  @IsIn(BROADCAST_TARGET_ROLES)
  targetRole?: BroadcastTargetRole;

  @ApiPropertyOptional({ description: 'Expiration date in ISO-8601 format' })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
