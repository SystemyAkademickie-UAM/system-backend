import { IsString, MaxLength, MinLength } from 'class-validator';

import { EDUCATION_ENROLLMENT_CODE_MAX_LENGTH } from '../../constants/database-entity-constants';

export class JoinGroupQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(EDUCATION_ENROLLMENT_CODE_MAX_LENGTH)
  code: string;
}
