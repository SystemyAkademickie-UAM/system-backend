import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../auth/session/session.service';
import { SUPER_ROLE_NAME } from '../constants/role-name-constants';
import { UserRolesService } from '../user-roles/user-roles-service';
import { MaintenanceModeService } from './maintenance-mode-service';

/** Allowed path prefixes during an active maintenance break. */
const MAINTENANCE_BYPASS_PATH_PREFIXES = [
  '/api/system',
  '/api/auth',
  '/api/docs',
  '/api/counter/health',
];

/**
 * Global guard blocking non-superadmin traffic when maintenance mode is active.
 * Bypasses status probes, auth flows (so superadmin can log in), and verified superadmin users.
 */
@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  constructor(
    private readonly maintenanceService: MaintenanceModeService,
    private readonly sessionService: SessionService,
    private readonly userRolesService: UserRolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isMaintenance = await this.maintenanceService.isMaintenanceActive();
    if (!isMaintenance) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.path ?? req.url ?? '';
    if (this.isBypassPath(path)) {
      return true;
    }

    // Super-administrators bypass maintenance mode to manage and recover the system
    try {
      const subject = await this.sessionService.resolveSubjectFromRequest(req);
      if (subject !== null) {
        const isSuperAdmin = await this.userRolesService.userHasRole(
          subject.userId,
          SUPER_ROLE_NAME,
        );
        if (isSuperAdmin) {
          return true;
        }
      }
    } catch {
      // Treat session resolution failure as regular blocked traffic
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

  private isBypassPath(path: string): boolean {
    const withoutQuery = path.split('?')[0] ?? '';
    return MAINTENANCE_BYPASS_PATH_PREFIXES.some((prefix) => {
      const withoutApiPrefix = prefix.startsWith('/api') ? prefix.slice('/api'.length) : prefix;
      return withoutQuery.startsWith(prefix) || withoutQuery.startsWith(withoutApiPrefix);
    });
  }
}
