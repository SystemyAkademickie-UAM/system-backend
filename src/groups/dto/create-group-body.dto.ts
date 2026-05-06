import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';

import { GroupPayloadDto } from './group-payload.dto';

export class CreateGroupBodyDto {
  @IsString()
  auth: string;

  @ValidateNested()
  @Type(() => GroupPayloadDto)
  group: GroupPayloadDto;
}
