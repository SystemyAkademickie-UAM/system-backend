/** JSON `statusCode` field for group entry-code generation contract. */
export const GROUP_GENERATE_CODE_API_JSON_STATUS_OK = 200;

/** Generated entry codes are 6 uppercase hex characters (3 random bytes). */
export const GROUP_ENTRY_CODE_GENERATED_LENGTH = 6;

/** Entropy byte length before hex encoding for generated entry codes. */
export const GROUP_ENTRY_CODE_GENERATED_BYTE_LENGTH = 3;

/** Max attempts when persisting a unique entry code. */
export const GROUP_ENTRY_CODE_GENERATION_MAX_ATTEMPTS = 5;

/**
 * Negative `groupId` response values (error states).
 * Public group IDs on success are always positive (include offset).
 */

/** Caller not authorized (invalid token, browser mismatch, not lecturer, or not group owner). */
export const GENERATE_CODE_RESULT_NOT_AUTHORIZED = -1;

/** Group does not exist. */
export const GENERATE_CODE_RESULT_GROUP_NOT_FOUND = -2;

/** Failed to persist a unique entry code. */
export const GENERATE_CODE_RESULT_DB_ERROR = -3;
