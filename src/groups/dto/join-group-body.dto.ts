import { IsString, Length, IsOptional } from 'class-validator';

export class JoinGroupBodyDto {
  @IsString()
  @Length(6, 6)
  code: string;

  @IsOptional()
  @IsString()
  auth?: string;
}
