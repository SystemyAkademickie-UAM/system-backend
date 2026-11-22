import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import {
  MAINTENANCE_API_PREFIX,
  MAINTENANCE_BYPASS_PATH_PREFIXES,
} from '../constants/maintenance-constants';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { MaintenanceModeService } from './maintenance-mode-service';

function normalizeRequestPath(rawPath: string): string {
  const withoutQuery = rawPath.split('?')[0] ?? '';
  const lowercased = withoutQuery.toLowerCase();
  if (lowercased.length > 1 && lowercased.endsWith('/')) {
    return lowercased.slice(0, -1);
  }
  return lowercased;
}

function matchesBypassCandidate(normalizedPath: string, candidate: string): boolean {
  return normalizedPath === candidate || normalizedPath.startsWith(`${candidate}/`);
}

function isBypassPath(rawPath: string): boolean {
  const normalizedPath = normalizeRequestPath(rawPath);
  if (normalizedPath.includes('..') || normalizedPath.includes('%')) {
    return false;
  }
  return MAINTENANCE_BYPASS_PATH_PREFIXES.some((prefix) => {
    const withoutApiPrefix = prefix.startsWith(MAINTENANCE_API_PREFIX)
      ? prefix.slice(MAINTENANCE_API_PREFIX.length)
      : prefix;
    return (
      matchesBypassCandidate(normalizedPath, prefix) ||
      matchesBypassCandidate(normalizedPath, withoutApiPrefix)
    );
  });
}

/**
 * Global guard blocking non-superadmin traffic on application routes when maintenance mode is active.
 * Bypasses status probes, auth/login/logout flows (for all users), and verified superadmin users.
 */
@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  constructor(
    private readonly maintenanceService: MaintenanceModeService,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  /**
   * Checks whether an incoming request is allowed while maintenance mode is active.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMaintenance = await this.maintenanceService.isMaintenanceActive();
    if (!isMaintenance) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    if (isBypassPath(path)) {
      return true;
    }
    if (await this.isAuthenticatedSuperAdmin(req)) {
      return true;
    }
    const status = await this.maintenanceService.getMaintenanceStatus();
    const notice = status.message && status.message.trim().length > 0
      ? status.message.trim()
      : 'System is currently undergoing technical maintenance';
    throw new ServiceUnavailableException({
      statusCode: 503,
      error: 'Service Unavailable',
      message: notice,
      maintenance: status,
    });
  }

  private async isAuthenticatedSuperAdmin(req: Request): Promise<boolean> {
    // Super-administrators bypass maintenance mode to manage and recover the system
    try {
      const subject = await this.sessionService.resolveSubjectFromRequest(req);
      if (subject === null) {
        return false;
      }
      return await this.userRolesService.userHasRole(
        subject.userId,
        SUPER_ROLE_NAME,
      );
    } catch {
      // Treat session resolution failure as regular blocked traffic
      return false;
    }
  }
}
