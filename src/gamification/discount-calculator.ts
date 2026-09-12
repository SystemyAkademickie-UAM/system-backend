import { SHOP_PROMOTION_PERCENT_MAX } from '../constants/shop-promotion-constants';
import { BadgeEntity } from '../database/entities/badge.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { ShopListingBadgePromotionEntity } from '../database/entities/shop-listing-badge-promotion.entity';
import { ShopListingRankPromotionEntity } from '../database/entities/shop-listing-rank-promotion.entity';

export interface AppliedDiscountDetail {
  source: 'rank' | 'badge';
  name: string;
  type: 'percent' | 'fixed';
  value: number;
  formattedText: string;
}

export interface DiscountDetailsResult {
  basePrice: number;
  finalPrice: number;
  rankDiscountedPrice: number;
  appliedDiscounts: AppliedDiscountDetail[];
  isMinPriceCapped: boolean;
  minPrice: number;
}

export class DiscountCalculator {
  static getDiscountDetails(
    basePrice: number,
    minPrice: number,
    earnedBadges: BadgeEntity[],
    eligibleRanks: RankEntity[],
    badgePromotions: ShopListingBadgePromotionEntity[],
    rankPromotions: ShopListingRankPromotionEntity[]
  ): DiscountDetailsResult {
    const appliedDiscounts: AppliedDiscountDetail[] = [];
    let totalBadgePercent = 0;
    let totalBadgeFixed = 0;

    for (const badge of earnedBadges) {
      const promo = badgePromotions.find(p => p.badgeId === badge.id);
      const type = promo ? promo.promotionType : badge.globalDiscountType;
      const val = promo ? promo.value : badge.globalDiscountValue;
      if (type === 'percent' && val && val > 0) {
        totalBadgePercent += val;
        appliedDiscounts.push({
          source: 'badge',
          name: badge.name || 'Odznaka',
          type: 'percent',
          value: val,
          formattedText: `Odznaka „${badge.name}”: -${val}%`,
        });
      } else if (type === 'fixed' && val && val > 0) {
        totalBadgeFixed += val;
        appliedDiscounts.push({
          source: 'badge',
          name: badge.name || 'Odznaka',
          type: 'fixed',
          value: val,
          formattedText: `Odznaka „${badge.name}”: -${val}`,
        });
      }
    }

    // Cap badge percent discounts at 100% to prevent over-discount
    totalBadgePercent = Math.min(totalBadgePercent, SHOP_PROMOTION_PERCENT_MAX);

    let maxRankDiscountVal = 0;
    let bestRankPercent = 0;
    let bestRankFixed = 0;
    let bestRank: RankEntity | null = null;

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
        bestRank = rank;
      }
    }

    if (bestRank && (bestRankPercent > 0 || bestRankFixed > 0)) {
      appliedDiscounts.unshift({
        source: 'rank',
        name: bestRank.name || 'Ranga',
        type: bestRankPercent > 0 ? 'percent' : 'fixed',
        value: bestRankPercent > 0 ? bestRankPercent : bestRankFixed,
        formattedText: bestRankPercent > 0
          ? `Ranga „${bestRank.name}”: -${bestRankPercent}%`
          : `Ranga „${bestRank.name}”: -${bestRankFixed}`,
      });
    }

    const totalPercent = Math.min(totalBadgePercent + bestRankPercent, SHOP_PROMOTION_PERCENT_MAX);
    const totalFixed = totalBadgeFixed + bestRankFixed;

    const rawDiscountedPrice = Math.floor(basePrice * (1 - totalPercent / 100)) - totalFixed;
    const finalPrice = Math.max(minPrice, rawDiscountedPrice);
    const isMinPriceCapped = minPrice > 0 && rawDiscountedPrice < minPrice;

    const rankOnlyRaw = Math.floor(basePrice * (1 - bestRankPercent / 100)) - bestRankFixed;
    const rankDiscountedPrice = Math.max(minPrice, rankOnlyRaw);

    return {
      basePrice,
      finalPrice,
      rankDiscountedPrice,
      appliedDiscounts,
      isMinPriceCapped,
      minPrice,
    };
  }

  static calculateDiscountedPrice(
    basePrice: number,
    minPrice: number,
    earnedBadges: BadgeEntity[],
    eligibleRanks: RankEntity[],
    badgePromotions: ShopListingBadgePromotionEntity[],
    rankPromotions: ShopListingRankPromotionEntity[]
  ): number {
    return this.getDiscountDetails(
      basePrice,
      minPrice,
      earnedBadges,
      eligibleRanks,
      badgePromotions,
      rankPromotions
    ).finalPrice;
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
