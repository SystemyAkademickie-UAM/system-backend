import type { BadgeEntity } from '../database/entities/badge.entity';
import type { VisibleBadge } from './visible-badge.type';

/**
 * Maps a badge to its read-model, hiding the details of a secret badge
 * the viewer is not allowed to see yet. Only the badge existence and its rarity (colour) stay visible.
 *
 * @param input.badge Badge definition.
 * @param input.canSeeSecret `true` for group owners and for students who earned the badge.
 */
export function toVisibleBadge(input: { readonly badge: BadgeEntity; readonly canSeeSecret: boolean }): VisibleBadge {
  const { badge, canSeeSecret } = input;
  const isRevealed = !badge.isSecret || canSeeSecret;
  if (isRevealed) {
    return { ...badge, isRevealed };
  }
  return {
    ...badge,
    name: null,
    educationalDescription: null,
    icon: null,
    storyDescription: null,
    rewardAmount: null,
    globalDiscountType: null,
    globalDiscountValue: null,
    isRevealed,
  };
}
