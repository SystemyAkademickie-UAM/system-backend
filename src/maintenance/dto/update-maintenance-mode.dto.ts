import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { MAINTENANCE_MESSAGE_MAX_LENGTH } from '../../constants/maintenance-constants';

/**
 * Payload for toggling or updating the maintenance mode state.
 */
export class UpdateMaintenanceModeDto {
  @ApiProperty({ description: 'Whether the maintenance break is currently active' })
  @IsDefined()
  @IsBoolean()
  isEnabled: boolean;

  @ApiPropertyOptional({
    description: 'Notice message displayed on the technical break screen',
    maxLength: MAINTENANCE_MESSAGE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAINTENANCE_MESSAGE_MAX_LENGTH)
  message?: string | null;

  @ApiPropertyOptional({
    description: 'Estimated end timestamp in ISO-8601 format',
  })
  @IsOptional()
  @IsISO8601()
  estimatedEndAt?: string | null;
}
