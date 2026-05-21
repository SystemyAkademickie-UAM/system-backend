import {
  ACTIVITY_RESPONSE_INVALID_REQUEST_ID,
  type ActivityMethod,
} from '../constants/activity-api-constants';

export type ParsedActivityRequest = {
  auth?: string;
  method: ActivityMethod;
  activityId?: number;
  stageId?: number;
  name?: string;
  currency?: number;
  educationalDescription?: string;
  storyDescription?: string;
};

export type ActivityParseFailure = {
  ok: false;
  method: ActivityMethod;
  activity: number;
};

export type ActivityParseSuccess = {
  ok: true;
  request: ParsedActivityRequest;
};

export type ActivityParseResult = ActivityParseFailure | ActivityParseSuccess;

const ACTIVITY_METHODS: readonly ActivityMethod[] = ['post', 'modify', 'remove', 'retrieve'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseActivityMethod(value: unknown): ActivityMethod | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (ACTIVITY_METHODS.includes(value as ActivityMethod)) {
    return value as ActivityMethod;
  }
  return null;
}

function parseOptionalAuth(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return null;
  }
  return value;
}

function parseOptionalPositiveInt(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) {
    return Number(value);
  }
  return null;
}

function parseOptionalNonNegativeInt(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function parseOptionalNonEmptyString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
}

function parseOptionalString(value: unknown): string | undefined | null {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    return null;
  }
  return value;
}

function invalid(method: ActivityMethod): ActivityParseFailure {
  return { ok: false, method, activity: ACTIVITY_RESPONSE_INVALID_REQUEST_ID };
}

/**
 * Parses flat activity API body without Nest validation messages.
 */
export function parseActivityRequest(body: unknown): ActivityParseResult {
  if (!isRecord(body)) {
    return invalid('post');
  }
  const method = parseActivityMethod(body.method);
  if (method === null) {
    return invalid('post');
  }
  const auth = parseOptionalAuth(body.auth);
  if (auth === null) {
    return invalid(method);
  }
  const activityId = parseOptionalPositiveInt(body.activityId);
  if (activityId === null) {
    return invalid(method);
  }
  const stageId = parseOptionalPositiveInt(body.stageId);
  if (stageId === null) {
    return invalid(method);
  }
  const name = parseOptionalNonEmptyString(body.name);
  if (name === null) {
    return invalid(method);
  }
  const currency = parseOptionalNonNegativeInt(body.currency);
  if (currency === null) {
    return invalid(method);
  }
  const educationalDescription = parseOptionalString(body.educationalDescription);
  if (educationalDescription === null) {
    return invalid(method);
  }
  const storyDescription = parseOptionalString(body.storyDescription);
  if (storyDescription === null) {
    return invalid(method);
  }
  return {
    ok: true,
    request: {
      auth,
      method,
      activityId,
      stageId,
      name,
      currency,
      educationalDescription,
      storyDescription,
    },
  };
}
