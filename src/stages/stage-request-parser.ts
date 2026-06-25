import {
  STAGE_RESPONSE_INVALID_REQUEST_ID,
  type StageMethod,
} from '../constants/stage-api-constants';

export type ParsedStageRequest = {
  auth?: string;
  method: StageMethod;
  stageId?: number;
  groupId?: number;
  name?: string;
  visibilityStatus?: number;
  stageIds?: number[];
  displayOrder?: number;
};

export type StageParseFailure = {
  ok: false;
  method: StageMethod;
  stage: number;
};

export type StageParseSuccess = {
  ok: true;
  request: ParsedStageRequest;
};

export type StageParseResult = StageParseFailure | StageParseSuccess;

const STAGE_METHODS: readonly StageMethod[] = ['post', 'modify', 'remove', 'retrieve', 'reorder'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStageMethod(value: unknown): StageMethod | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (STAGE_METHODS.includes(value as StageMethod)) {
    return value as StageMethod;
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

function parseOptionalVisibilityStatus(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isInteger(parsed) && (parsed === 0 || parsed === 1 || parsed === 2)) {
    return parsed;
  }
  return null;
}

function parseOptionalPositiveIntArray(value: unknown): number[] | undefined | null {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return null;
  const res: number[] = [];
  for (const item of value) {
    if (typeof item === 'number' && Number.isInteger(item) && item > 0) res.push(item);
    else if (typeof item === 'string' && /^[1-9]\d*$/.test(item)) res.push(Number(item));
    else return null;
  }
  return res;
}

function parseOptionalInt(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function invalid(method: StageMethod): StageParseFailure {
  return { ok: false, method, stage: STAGE_RESPONSE_INVALID_REQUEST_ID };
}

/**
 * Parses flat stage API body without Nest validation messages.
 */
export function parseStageRequest(body: unknown): StageParseResult {
  if (!isRecord(body)) {
    return invalid('post');
  }
  const method = parseStageMethod(body.method);
  if (method === null) {
    return invalid('post');
  }
  const auth = parseOptionalAuth(body.auth);
  if (auth === null) {
    return invalid(method);
  }
  const stageId = parseOptionalPositiveInt(body.stageId);
  if (stageId === null) {
    return invalid(method);
  }
  const groupId = parseOptionalPositiveInt(body.groupId);
  if (groupId === null) {
    return invalid(method);
  }
  const name = parseOptionalNonEmptyString(body.name);
  if (name === null) {
    return invalid(method);
  }
  const visibilityStatus = parseOptionalVisibilityStatus(body.visibilityStatus);
  if (visibilityStatus === null) {
    return invalid(method);
  }
  const stageIds = parseOptionalPositiveIntArray(body.stageIds);
  if (stageIds === null) return invalid(method);
  const displayOrder = parseOptionalInt(body.displayOrder);
  if (displayOrder === null) return invalid(method);

  if (method === 'reorder' && (!groupId || !stageIds || stageIds.length === 0)) {
    return invalid('reorder');
  }

  return {
    ok: true,
    request: {
      auth,
      method,
      stageId,
      groupId,
      name,
      visibilityStatus,
      stageIds,
      displayOrder,
    },
  };
}
