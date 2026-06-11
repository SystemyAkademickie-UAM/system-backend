import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Payload for selecting the active role from the roles a user holds. */
export class SelectActiveRoleDto {
  @ApiProperty({
    description: 'Role to activate; must be one the user currently holds.',
    example: 'lecturer',
  })
  @IsString()
  @IsNotEmpty()
  role!: string;
}
