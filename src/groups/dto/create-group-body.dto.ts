import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { GroupPayloadDto } from './group-payload.dto';

export class CreateGroupBodyDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  @ValidateNested()
  @Type(() => GroupPayloadDto)
  group: GroupPayloadDto;
}
