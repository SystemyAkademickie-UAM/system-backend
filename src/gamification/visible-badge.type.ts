import type { BadgeEntity } from '../database/entities/badge.entity';

/**
 * Badge fields hidden from viewers who have not earned a secret badge yet.
 * `rarity` is intentionally NOT listed: students may see the badge colour (quality) of a secret badge.
 */
type SecretBadgeField =
  | 'name'
  | 'educationalDescription'
  | 'icon'
  | 'storyDescription'
  | 'rewardAmount'
  | 'globalDiscountType'
  | 'globalDiscountValue';

/**
 * Badge read-model returned by badge listing endpoints.
 * For an unrevealed secret badge every {@link SecretBadgeField} is `null` and `isRevealed` is `false`;
 * `rarity` stays visible so the client can show the badge colour.
 */
export type VisibleBadge = Omit<BadgeEntity, SecretBadgeField> & {
  [Field in SecretBadgeField]: BadgeEntity[Field] | null;
} & {
  isRevealed: boolean;
};
