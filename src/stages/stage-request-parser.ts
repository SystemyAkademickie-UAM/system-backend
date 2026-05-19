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

const STAGE_METHODS: readonly StageMethod[] = ['post', 'modify', 'remove', 'retrieve'];

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
  return {
    ok: true,
    request: {
      auth,
      method,
      stageId,
      groupId,
      name,
    },
  };
}
