import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class GenerateCodeBodyDto {
  /** Optional when using `maq_auth` cookie (browser clients). */
  @IsOptional()
  @IsString()
  auth?: string;

  /** Public group ID (includes `GROUP_RESPONSE_GROUP_ID_OFFSET`). Values below the offset are accepted as raw DB ids for backwards compatibility. */
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const n = Number.parseInt(value.trim(), 10);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  })
  @IsInt()
  @Min(1)
  groupId: number;
}
