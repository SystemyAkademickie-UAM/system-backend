/**
 * Serialized representation of an FAQ entry returned by admin endpoints.
 */
export type FaqItemResponse = {
  readonly id: number;
  readonly question: string;
  readonly answer: string;
  readonly category: string;
  readonly orderIndex: number;
  readonly isPublished: boolean;
  readonly createdByUserId: number | null;
  readonly updatedByUserId: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Serialized representation of an FAQ entry returned by read endpoints (omits internal user IDs).
 */
export type PublicFaqItemResponse = Omit<
  FaqItemResponse,
  'createdByUserId' | 'updatedByUserId'
>;

/**
 * FAQ entries grouped under a common category for accordion displays.
 */
export type FaqGroupedCategoryResponse = {
  readonly category: string;
  readonly items: readonly PublicFaqItemResponse[];
};

/**
 * Response payload returned after successfully deleting an FAQ entry.
 */
export type FaqDeleteResponse = {
  readonly deleted: true;
  readonly id: number;
};

