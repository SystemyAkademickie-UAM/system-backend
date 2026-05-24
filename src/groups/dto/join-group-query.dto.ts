import { IsOptional, IsString, Length } from 'class-validator';

export class JoinGroupQueryDto {
  @IsString()
  @Length(6, 6)
  code: string;

  @IsOptional()
  @IsString()
  auth?: string;
}
