export type BacklogEventType =
  | 'STUDENT_JOINED'
  | 'SHOP_PURCHASE'
  | 'ITEM_USED'
  | 'ACTIVITY_COMPLETED'
  | 'RANK_UP'
  | 'BADGE_EARNED'
  | 'STAGE_ADDED'
  | 'BADGE_ADDED'
  | 'RANK_ADDED'
  | 'SHOP_ITEM_ADDED'
  | 'LIVES_SYSTEM_CHANGED'
  | 'SHOP_STATUS_CHANGED'
  | 'POST_ADDED'
  | 'STAGE_COMPLETED'
  | 'CURRENCY_ADDED'
  | 'LIVES_CHANGED'
  | 'OTHER';

export type BacklogPayload = Record<string, unknown>;

export function serializeBacklogPayload(payload: BacklogPayload | string | null | undefined): string | null {
  if (payload == null) {
    return null;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  return JSON.stringify(payload);
}

export function parseBacklogPayload(value: string | null | undefined): BacklogPayload {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as BacklogPayload;
    }
  } catch {
    return { message: value };
  }

  return { message: value };
}

export function backlogMessage(payload: BacklogPayload, fallback = ''): string {
  const message = payload.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
}
