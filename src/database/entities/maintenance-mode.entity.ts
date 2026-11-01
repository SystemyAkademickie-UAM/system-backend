import { Column, Entity, PrimaryColumn } from 'typeorm';

import { MAINTENANCE_MESSAGE_MAX_LENGTH } from '../../constants/maintenance-constants';
import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Singleton configuration row (`services.maintenance_mode`) for system-wide technical break.
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'maintenance_mode' })
export class MaintenanceModeEntity {
  @PrimaryColumn({ type: 'integer' })
  id: number;

  @Column({ name: 'is_enabled', type: 'boolean', default: false })
  isEnabled: boolean;

  @Column({ type: 'varchar', length: MAINTENANCE_MESSAGE_MAX_LENGTH, nullable: true, default: null })
  message: string | null;

  @Column({ name: 'estimated_end_at', type: 'timestamp with time zone', nullable: true, default: null })
  estimatedEndAt: Date | null;

  @Column({ name: 'updated_by_user_id', type: 'integer', nullable: true, default: null })
  updatedByUserId: number | null;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  updatedAt: Date;
}
