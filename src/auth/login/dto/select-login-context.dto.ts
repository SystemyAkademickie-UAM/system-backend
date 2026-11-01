import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

import { AUTH_ACCOUNT_ROLE_MAX_LENGTH } from '../../../constants/database-entity-constants';

/** Organization and role the user confirms for this session and the next login. */
export class SelectLoginContextDto {
  @ApiProperty({ description: 'Organization the user belongs to.', example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  organizationId!: number;

  @ApiProperty({
    description: 'Role the user holds in that organization.',
    example: 'lecturer',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(AUTH_ACCOUNT_ROLE_MAX_LENGTH)
  role!: string;
}
