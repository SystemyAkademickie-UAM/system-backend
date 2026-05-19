/** JSON `status` field for activity API responses. */
export const ACTIVITY_API_JSON_STATUS_OK = 200;

/** JSON `status` field when authorization fails. */
export const ACTIVITY_API_JSON_STATUS_FORBIDDEN = 403;

/** JSON `status` field when request body or field values are invalid. */
export const ACTIVITY_API_JSON_STATUS_BAD_REQUEST = 400;

/** Response `activity` field when creation/modification failed. */
export const ACTIVITY_RESPONSE_NOT_CREATED_ID = -1;

/** Response `activity` field when not authorized. */
export const ACTIVITY_RESPONSE_NOT_AUTHORIZED_ID = -2;

/** Response `activity` field when activity not found. */
export const ACTIVITY_RESPONSE_NOT_FOUND_ID = -3;

/** Response `activity` field when stage not found. */
export const ACTIVITY_RESPONSE_STAGE_NOT_FOUND_ID = -4;

/** Response `activity` field when request JSON or field types/ranges are invalid. */
export const ACTIVITY_RESPONSE_INVALID_REQUEST_ID = -5;

/** Available methods for activity API. */
export type ActivityMethod = 'post' | 'modify' | 'remove' | 'retrieve';
