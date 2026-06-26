import type { CreateRankDto } from './dto/create-rank.dto';
import type { UpdateRankDto } from './dto/update-rank.dto';
import { mapLegacyGlobalDiscount } from '../groups/group-templates/group-template-legacy-discount';

type RankDiscountDto = (CreateRankDto | UpdateRankDto) & {
  discount?: number;
  storeDiscount?: number;
};

/**
 * Accepts legacy `discount` / `storeDiscount` request fields and maps them to global discount fields.
 */
export function normalizeRankDiscountDto(dto: RankDiscountDto): void {
  const hasLegacyFields = dto.discount !== undefined || dto.storeDiscount !== undefined;
  if (!hasLegacyFields) {
    return;
  }

  if (dto.globalDiscountType === undefined && dto.globalDiscountValue === undefined) {
    const mapped = mapLegacyGlobalDiscount(dto);
    if (mapped.globalDiscountType != null) {
      dto.globalDiscountType = mapped.globalDiscountType;
      dto.globalDiscountValue = mapped.globalDiscountValue;
    }
  }

  delete dto.discount;
  delete dto.storeDiscount;
}
