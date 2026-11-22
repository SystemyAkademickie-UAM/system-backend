import { ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from 'class-validator';

type CursorQuery = {
  before?: string;
  beforeId?: number;
  beforeSource?: string;
};

/**
 * Requires the page cursor to be absent or complete.
 * A page that sends only some of before, beforeId, and beforeSource is rejected.
 */
@ValidatorConstraint({ name: 'organizationLogCursorComplete', async: false })
export class OrganizationLogCursorCompleteConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    const query = args?.object as CursorQuery | undefined;
    if (query === undefined) {
      return false;
    }
    const hasBefore = query.before !== undefined;
    const hasBeforeId = query.beforeId !== undefined;
    const hasBeforeSource = query.beforeSource !== undefined;
    return hasBefore === hasBeforeId && hasBefore === hasBeforeSource;
  }

  defaultMessage(): string {
    return 'before, beforeId, and beforeSource must be sent together';
  }
}
