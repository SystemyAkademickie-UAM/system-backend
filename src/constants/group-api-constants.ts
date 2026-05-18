import { BadRequestException } from '@nestjs/common';

/** JSON `status` field for group and drive contract examples. */
export const GROUP_API_JSON_STATUS_OK = 200;

/** Response `group` field when creation failed (business / validation / DB). */
export const GROUP_RESPONSE_GROUP_NOT_CREATED_ID = 0;

/** Response `group` field when token, browser, or lecturer role check fails. */
export const GROUP_RESPONSE_GROUP_NOT_AUTHORIZED_ID = 1;


/** Response `group` field offset for group ID. */
export const GROUP_RESPONSE_GROUP_ID_OFFSET = 100000;

/**
 * Converts a public (URL-facing) group ID to the internal DB ID by stripping the offset.
 * Throws if the value is below the offset threshold (raw internal IDs are not accepted).
 */
export function toInternalGroupId(publicGroupId: number): number {
  if (publicGroupId < GROUP_RESPONSE_GROUP_ID_OFFSET) {
    throw new BadRequestException(
      `Invalid group ID: ${publicGroupId}. Expected a public ID >= ${GROUP_RESPONSE_GROUP_ID_OFFSET}.`,
    );
  }
  return publicGroupId - GROUP_RESPONSE_GROUP_ID_OFFSET;
}