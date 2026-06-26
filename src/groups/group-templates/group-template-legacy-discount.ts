import type { GroupTemplateBadge, GroupTemplateRank } from './group-template-data.interface';

export interface LegacyGlobalDiscountFields {
  globalDiscountType?: string | null;
  globalDiscountValue?: number | null;
  discount?: number | null;
  storeDiscount?: number | null;
}

/**
 * Maps legacy snapshot/API discount fields to the current global discount contract.
 */
export function mapLegacyGlobalDiscount(source: LegacyGlobalDiscountFields): {
  globalDiscountType: string | null;
  globalDiscountValue: number;
} {
  if (source.globalDiscountType != null) {
    return {
      globalDiscountType: source.globalDiscountType,
      globalDiscountValue: source.globalDiscountValue ?? 0,
    };
  }

  const percent = Number(source.discount ?? 0);
  if (Number.isFinite(percent) && percent > 0) {
    return { globalDiscountType: 'percent', globalDiscountValue: Math.round(percent) };
  }

  const fixed = Number(source.storeDiscount ?? 0);
  if (Number.isFinite(fixed) && fixed > 0) {
    return { globalDiscountType: 'fixed', globalDiscountValue: Math.round(fixed) };
  }

  return { globalDiscountType: null, globalDiscountValue: 0 };
}

export function mapLegacyRankDiscount(oldRank: GroupTemplateRank & LegacyGlobalDiscountFields) {
  return mapLegacyGlobalDiscount(oldRank);
}

export function mapLegacyBadgeDiscount(oldBadge: GroupTemplateBadge & LegacyGlobalDiscountFields) {
  return mapLegacyGlobalDiscount(oldBadge);
}
