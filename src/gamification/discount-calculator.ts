import { SHOP_PROMOTION_PERCENT_MAX } from '../constants/shop-promotion-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { ShopListingBadgePromotionEntity } from '../database/entities/shop-listing-badge-promotion.entity';
import { ShopListingRankPromotionEntity } from '../database/entities/shop-listing-rank-promotion.entity';

export class DiscountCalculator {
  static calculateDiscountedPrice(
    basePrice: number,
    earnedBadges: BadgeEntity[],
    eligibleRanks: RankEntity[],
    badgePromotions: ShopListingBadgePromotionEntity[], // dotyczy tylko 1 listing_id
    rankPromotions: ShopListingRankPromotionEntity[] // dotyczy tylko 1 listing_id
  ): number {
    let totalBadgePercent = 0;
    let totalBadgeFixed = 0;

    for (const badge of earnedBadges) {
      const promo = badgePromotions.find(p => p.badgeId === badge.id);
      const type = promo ? promo.promotionType : badge.globalDiscountType;
      const val = promo ? promo.value : badge.globalDiscountValue;
      if (type === 'percent') totalBadgePercent += (val || 0);
      else if (type === 'fixed') totalBadgeFixed += (val || 0);
    }

    // Cap badge percent discounts at 100% to prevent over-discount
    totalBadgePercent = Math.min(totalBadgePercent, SHOP_PROMOTION_PERCENT_MAX);

    let maxRankDiscountVal = 0;
    let bestRankPercent = 0;
    let bestRankFixed = 0;

    for (const rank of eligibleRanks) {
      const promo = rankPromotions.find(p => p.rankId === rank.id);
      const type = promo ? promo.promotionType : rank.globalDiscountType;
      const val = promo ? promo.value : rank.globalDiscountValue;
      
      const curPercent = type === 'percent' ? (val || 0) : 0;
      const curFixed = type === 'fixed' ? (val || 0) : 0;
      
      // Effective saving for this specific rank rules
      const effectiveSaving = basePrice - Math.max(0, Math.floor(basePrice * (1 - curPercent / 100)) - curFixed);
      if (effectiveSaving > maxRankDiscountVal) {
        maxRankDiscountVal = effectiveSaving;
        bestRankPercent = curPercent;
        bestRankFixed = curFixed;
      }
    }

    const totalPercent = Math.min(totalBadgePercent + bestRankPercent, SHOP_PROMOTION_PERCENT_MAX);
    const totalFixed = totalBadgeFixed + bestRankFixed;

    const discountedPrice = Math.floor(basePrice * (1 - totalPercent / 100)) - totalFixed;
    return Math.max(0, discountedPrice);
  }

  static isItemLocked(
    itemId: number,
    allRanks: RankEntity[],
    studentTotalEarned: number
  ): boolean {
    const idStr = itemId.toString();
    let inAnyRank = false;
    let inUnlockedRank = false;

    for (const rank of allRanks) {
      if (rank.uniqueStoreItems && rank.uniqueStoreItems.includes(idStr)) {
        inAnyRank = true;
        if (rank.requiredPoints <= studentTotalEarned) {
          inUnlockedRank = true;
        }
      }
    }

    if (!inAnyRank) return false; // Not restricted to any rank
    return !inUnlockedRank; // Locked if it's restricted and no achieved rank unlocks it
  }
}
