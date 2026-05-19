/** JSON `status` field for stage API responses. */
export const STAGE_API_JSON_STATUS_OK = 200;

/** JSON `status` field when authorization fails. */
export const STAGE_API_JSON_STATUS_FORBIDDEN = 403;

/** JSON `status` field when request body or field values are invalid. */
export const STAGE_API_JSON_STATUS_BAD_REQUEST = 400;

/** Response `stage` field when creation/modification failed. */
export const STAGE_RESPONSE_NOT_CREATED_ID = -1;

/** Response `stage` field when not authorized. */
export const STAGE_RESPONSE_NOT_AUTHORIZED_ID = -2;

/** Response `stage` field when stage not found. */
export const STAGE_RESPONSE_NOT_FOUND_ID = -3;

/** Response `stage` field when request JSON or field types/ranges are invalid. */
export const STAGE_RESPONSE_INVALID_REQUEST_ID = -4;

/** Available methods for stage API. */
export type StageMethod = 'post' | 'modify' | 'remove' | 'retrieve';
