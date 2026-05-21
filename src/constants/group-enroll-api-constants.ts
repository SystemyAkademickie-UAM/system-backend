/** JSON `statusCode` field for group enrollment contract (matches groups pattern). */
export const GROUP_ENROLL_API_JSON_STATUS_OK = 200;

/**
 * Negative enrollment result codes (error states).
 * Real enrollment IDs are always positive, so negative = error.
 */

/** Caller not authorized (invalid token, browser mismatch, no student account). */
export const ENROLL_RESULT_NOT_AUTHORIZED = -1;

/** Group does not exist. */
export const ENROLL_RESULT_GROUP_NOT_FOUND = -2;

/** Database insert failed (FK violation, constraint, etc.). */
export const ENROLL_RESULT_DB_ERROR = -3;
