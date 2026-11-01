/** Public view of a broadcast announcement. */
export type BroadcastResponse = {
  id: number;
  title: string;
  content: string;
  level: string;
  targetRole: string;
  expiresAt: string | null;
  createdAt: string;
};

/** Paginated admin broadcast list response. */
export type BroadcastListResponse = {
  items: BroadcastResponse[];
  total: number;
};
