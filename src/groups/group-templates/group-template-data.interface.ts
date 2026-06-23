/**
 * Shape of the JSONB `data` column in `education.group_templates`.
 *
 * Captures a full snapshot of a group's configuration (without student data)
 * so that the group can be recreated from a template later.
 */
export interface GroupTemplateData {
  /** Core group settings (name, currency, lives, banner, etc.). */
  group: GroupTemplateGroupSettings;
  /** Badges defined in the group. */
  badges: GroupTemplateBadge[];
  /** Ranks defined in the group. */
  ranks: GroupTemplateRank[];
  /** Item categories in the group shop. */
  itemCategories: GroupTemplateItemCategory[];
  /** Items in the group shop, each with its listing + pricing rules. */
  items: GroupTemplateItem[];
  /** Posts / announcements in the group. */
  posts: GroupTemplatePost[];
  /** Stages with nested activities. */
  stages: GroupTemplateStage[];
}

export interface GroupTemplateGroupSettings {
  name: string;
  subjectName: string | null;
  imageRef: string | null;
  description: string | null;
  currency: string | null;
  currencyEmoji: string | null;
  lives: number | null;
  startingLives: number | null;
  livesIcon: string | null;
}

export interface GroupTemplateBadge {
  id: number;
  groupId: number | null;
  name: string;
  educationalDescription: string | null;
  icon: string | null;
  storyDescription: string | null;
  rewardAmount: number | null;
  rarity: string;
}

export interface GroupTemplateRank {
  id: number;
  groupId: number | null;
  name: string;
  requiredPoints: number;
  icon: string | null;
  storyDescription: string | null;
  storeDiscount: number | null;
  uniqueStoreItems: string[] | null;
  discount: number;
}

export interface GroupTemplateItemCategory {
  id: number;
  groupId: number;
  name: string;
  description: string | null;
  displayOrder: number | null;
}

export interface GroupTemplateShopListingRankPrice {
  rankId: number;
  price: number;
}

export interface GroupTemplateShopListingBadgePromotion {
  badgeId: number;
  promotionType: string;
  value: number;
}

export interface GroupTemplateShopListing {
  basePrice: number;
  stockQuantity: number | null;
  perStudentLimit: number | null;
  rankPrices: GroupTemplateShopListingRankPrice[];
  badgePromotions: GroupTemplateShopListingBadgePromotion[];
}

export interface GroupTemplateItem {
  id: number;
  groupId: number;
  categoryId: number | null;
  imageRef: string | null;
  name: string;
  educationalDescription: string | null;
  listing: GroupTemplateShopListing | null;
}

export interface GroupTemplatePost {
  title: string | null;
  content: string | null;
}

export interface GroupTemplateActivity {
  name: string;
  currency: number;
  educationalDescription: string;
  storyDescription: string;
}

export interface GroupTemplateStage {
  id: number;
  groupId: number;
  name: string;
  activities: GroupTemplateActivity[];
}
