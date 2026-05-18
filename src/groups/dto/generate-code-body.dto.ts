import { IsOptional, IsString } from 'class-validator';

export class GenerateCodeBodyDto {
  @IsOptional()
  @IsString()
  type?: string;
}
