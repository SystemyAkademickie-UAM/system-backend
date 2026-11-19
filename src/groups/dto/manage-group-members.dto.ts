import { IsArray, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateGroupMembersDto {
  @IsOptional()
  @IsInt()
  teacherAccountId?: number;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  addStudentAccountIds?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  removeStudentAccountIds?: number[];
}

