import { BadgeEntity, PromotionType } from '../database/entities/badge.entity';
import { RankEntity } from '../database/entities/rank.entity';
import { DiscountCalculator } from './discount-calculator';

describe('DiscountCalculator', () => {
  const basePrice = 100;

  const badge = (id: number, type: string | null, value: number | null): BadgeEntity =>
    ({ id, globalDiscountType: type, globalDiscountValue: value }) as BadgeEntity;

  const rank = (
    id: number,
    requiredPoints: number,
    type: string | null,
    value: number | null,
    uniqueStoreItems: string[] | null = null,
  ): RankEntity =>
    ({
      id,
      requiredPoints,
      globalDiscountType: type,
      globalDiscountValue: value,
      uniqueStoreItems,
    }) as RankEntity;

  describe('calculateDiscountedPrice', () => {
    it('returns base price when no discounts apply', () => {
      const actualPrice = DiscountCalculator.calculateDiscountedPrice(basePrice, [], [], [], []);
      expect(actualPrice).toBe(100);
    });

    it('applies badge fixed and percent discounts', () => {
      const earnedBadges = [badge(1, PromotionType.FIXED, 10), badge(2, PromotionType.PERCENT, 20)];
      const actualPrice = DiscountCalculator.calculateDiscountedPrice(
        basePrice,
        earnedBadges,
        [],
        [],
        [],
      );
      expect(actualPrice).toBe(70);
    });

    it('caps stacked badge percent discounts at 100%', () => {
      const earnedBadges = [
        badge(1, PromotionType.PERCENT, 60),
        badge(2, PromotionType.PERCENT, 60),
      ];
      const actualPrice = DiscountCalculator.calculateDiscountedPrice(
        basePrice,
        earnedBadges,
        [],
        [],
        [],
      );
      expect(actualPrice).toBe(0);
    });

    it('uses the best eligible rank discount only', () => {
      const eligibleRanks = [
        rank(1, 0, PromotionType.FIXED, 5),
        rank(2, 0, PromotionType.FIXED, 25),
      ];
      const actualPrice = DiscountCalculator.calculateDiscountedPrice(
        basePrice,
        [],
        eligibleRanks,
        [],
        [],
      );
      expect(actualPrice).toBe(75);
    });

    it('prefers listing-specific promotion over rank global discount', () => {
      const eligibleRanks = [rank(1, 0, PromotionType.PERCENT, 10)];
      const rankPromotions = [{ rankId: 1, promotionType: PromotionType.FIXED, value: 30 } as never];
      const actualPrice = DiscountCalculator.calculateDiscountedPrice(
        basePrice,
        [],
        eligibleRanks,
        [],
        rankPromotions,
      );
      expect(actualPrice).toBe(70);
    });
  });

  describe('isItemLocked', () => {
    it('returns false when item is not in any rank uniqueStoreItems', () => {
      const actualLocked = DiscountCalculator.isItemLocked(42, [rank(1, 0, null, null, ['99'])], 500);
      expect(actualLocked).toBe(false);
    });

    it('returns true when item is rank-gated and student points are too low', () => {
      const actualLocked = DiscountCalculator.isItemLocked(
        42,
        [rank(1, 100, null, null, ['42'])],
        50,
      );
      expect(actualLocked).toBe(true);
    });

    it('returns false when student reached the required rank', () => {
      const actualLocked = DiscountCalculator.isItemLocked(
        42,
        [rank(1, 100, null, null, ['42'])],
        100,
      );
      expect(actualLocked).toBe(false);
    });
  });
});
