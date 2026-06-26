import { mapLegacyGlobalDiscount, mapLegacyRankDiscount } from './group-template-legacy-discount';

describe('group-template-legacy-discount', () => {
  it('keeps explicit global discount fields', () => {
    expect(mapLegacyGlobalDiscount({
      globalDiscountType: 'fixed',
      globalDiscountValue: 7,
    })).toEqual({
      globalDiscountType: 'fixed',
      globalDiscountValue: 7,
    });
  });

  it('maps legacy percent discount', () => {
    expect(mapLegacyRankDiscount({
      id: 1,
      groupId: 1,
      name: 'Rank',
      requiredPoints: 10,
      icon: '🏅',
      storyDescription: null,
      uniqueStoreItems: null,
      globalDiscountType: null,
      globalDiscountValue: null,
      discount: 15,
    })).toEqual({
      globalDiscountType: 'percent',
      globalDiscountValue: 15,
    });
  });

  it('maps legacy fixed store discount', () => {
    expect(mapLegacyRankDiscount({
      id: 1,
      groupId: 1,
      name: 'Rank',
      requiredPoints: 10,
      icon: '🏅',
      storyDescription: null,
      uniqueStoreItems: null,
      globalDiscountType: null,
      globalDiscountValue: null,
      storeDiscount: 5,
    })).toEqual({
      globalDiscountType: 'fixed',
      globalDiscountValue: 5,
    });
  });
});
