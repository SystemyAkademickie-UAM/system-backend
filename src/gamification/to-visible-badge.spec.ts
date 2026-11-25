import { BadgeEntity } from '../database/entities/badge.entity';
import { toVisibleBadge } from './to-visible-badge';

function buildBadge(overrides: Partial<BadgeEntity> = {}): BadgeEntity {
  return Object.assign(new BadgeEntity(), {
    id: 5,
    groupId: 7,
    name: 'Ukryty mistrz',
    educationalDescription: 'Za 10 aktywności z rzędu',
    icon: '🦉',
    storyDescription: 'Legenda głosi…',
    rewardAmount: 42,
    rarity: 'epic',
    isPublished: true,
    publishedAt: null,
    globalDiscountType: 'percent',
    globalDiscountValue: 10,
    isSecret: false,
    ...overrides,
  });
}

describe('toVisibleBadge', () => {
  it('returns a regular badge unchanged and marked as revealed', () => {
    const inputBadge = buildBadge();
    const actual = toVisibleBadge({ badge: inputBadge, canSeeSecret: false });
    expect(actual).toEqual({ ...inputBadge, isRevealed: true });
  });

  it('reveals a secret badge when the viewer can see it', () => {
    const inputBadge = buildBadge({ isSecret: true });
    const actual = toVisibleBadge({ badge: inputBadge, canSeeSecret: true });
    expect(actual).toEqual({ ...inputBadge, isRevealed: true });
  });

  it('masks secret badge details but keeps the rarity (colour) visible', () => {
    const inputBadge = buildBadge({ isSecret: true });
    const actual = toVisibleBadge({ badge: inputBadge, canSeeSecret: false });
    expect(actual).toEqual({
      id: 5,
      groupId: 7,
      name: null,
      educationalDescription: null,
      icon: null,
      storyDescription: null,
      rewardAmount: null,
      rarity: 'epic',
      isPublished: true,
      publishedAt: null,
      globalDiscountType: null,
      globalDiscountValue: null,
      isSecret: true,
      isRevealed: false,
    });
  });

  it('does not mutate the source entity when masking', () => {
    const inputBadge = buildBadge({ isSecret: true });
    toVisibleBadge({ badge: inputBadge, canSeeSecret: false });
    expect(inputBadge.name).toBe('Ukryty mistrz');
    expect(inputBadge.rewardAmount).toBe(42);
  });
});
