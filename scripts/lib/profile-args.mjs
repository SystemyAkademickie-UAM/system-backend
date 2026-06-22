import { AUTH_USER_NAME_FIELD_MAX_LENGTH, truncateField } from './pg-client.mjs';

export const AUTH_USER_LANGUAGE_MAX_LENGTH = 10;

export const DEFAULT_AVATAR_ID = 1;
export const EMAIL_LOGIN_PLACEHOLDER_STUDENT_ID = 0;
export const DEFAULT_USER_LANGUAGE = 'PL';
export const DEFAULT_PLACEHOLDER_NAME = '-';

const PROFILE_VALUE_FLAGS = [
  ['--name', 'name'],
  ['--surname', 'surname'],
  ['--nickname', 'nickname'],
  ['--avatar-id', 'avatarId'],
  ['--language', 'language'],
  ['--student-id', 'studentId'],
];

function assertNonEmptyProfileField(fieldLabel, rawValue) {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldLabel} cannot be empty`);
  }
  return trimmed;
}

function parsePositiveInteger(fieldLabel, rawValue) {
  const trimmed = rawValue.trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(fieldLabel, rawValue) {
  const trimmed = rawValue.trim();
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a non-negative integer`);
  }
  return parsed;
}

/**
 * @param {string[]} argv
 * @returns {{
 *   name: string | null,
 *   surname: string | null,
 *   nickname: string | null,
 *   avatarId: number | null,
 *   language: string | null,
 *   studentId: number | null,
 * }}
 */
export function parseProfileFromArgs(argv) {
  /** @type {Record<string, string | number | null>} */
  const provided = {
    name: null,
    surname: null,
    nickname: null,
    avatarId: null,
    language: null,
    studentId: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const flag = PROFILE_VALUE_FLAGS.find(([flagName]) => flagName === arg);
    if (flag === undefined) {
      continue;
    }
    const rawValue = argv[index + 1]?.trim() ?? '';
    if (rawValue.length === 0) {
      throw new Error(`Missing value for ${flag[0]}`);
    }
    index += 1;
    const fieldKey = flag[1];
    if (fieldKey === 'avatarId') {
      provided.avatarId = parsePositiveInteger('--avatar-id', rawValue);
      continue;
    }
    if (fieldKey === 'studentId') {
      provided.studentId = parseNonNegativeInteger('--student-id', rawValue);
      continue;
    }
    if (fieldKey === 'language') {
      provided.language = truncateField(assertNonEmptyProfileField('--language', rawValue), AUTH_USER_LANGUAGE_MAX_LENGTH);
      continue;
    }
    provided[fieldKey] = truncateField(
      assertNonEmptyProfileField(flag[0], rawValue),
      AUTH_USER_NAME_FIELD_MAX_LENGTH,
    );
  }
  return /** @type {ReturnType<typeof parseProfileFromArgs>} */ (provided);
}

/**
 * @param {string} normalizedEmail
 * @param {ReturnType<typeof parseProfileFromArgs>} provided
 */
export function resolveProfileForNewUser(normalizedEmail, provided) {
  const nicknameBase = provided.nickname ?? normalizedEmail.split('@')[0] ?? 'user';
  const nickname = truncateField(nicknameBase.trim() || 'user', AUTH_USER_NAME_FIELD_MAX_LENGTH);
  return {
    name: provided.name ?? DEFAULT_PLACEHOLDER_NAME,
    surname: provided.surname ?? DEFAULT_PLACEHOLDER_NAME,
    nickname,
    avatarId: provided.avatarId ?? DEFAULT_AVATAR_ID,
    language: provided.language ?? DEFAULT_USER_LANGUAGE,
    studentId: provided.studentId ?? EMAIL_LOGIN_PLACEHOLDER_STUDENT_ID,
  };
}

export function profileFlagUsageSuffix() {
  return '[--name <name>] [--surname <surname>] [--nickname <nickname>] [--avatar-id <id>] [--language <code>] [--student-id <id>]';
}
