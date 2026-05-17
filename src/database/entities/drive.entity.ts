import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SERVICES_DRIVE_MIME_TYPE_MAX_LENGTH } from '../../constants/database-entity-constants';
import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Organization file reference (`services.drive`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'drive' })
export class DriveEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Unique file reference (UUID). */
  @Column({ name: 'ref', type: 'uuid', unique: true, nullable: false })
  ref: string;

  /** File size in bytes. */
  @Column({ name: 'size', type: 'integer', nullable: false })
  size: number;

  /** MIME type (short code). */
  @Column({ name: 'mime_type', type: 'varchar', length: SERVICES_DRIVE_MIME_TYPE_MAX_LENGTH, nullable: false })
  mimeType: string;

  /** UTC timestamp when file was created. */
  @Column({ name: 'created_at', type: 'timestamptz', nullable: false })
  createdAt: Date;

  /** FK to `auth.organizations.id`. */
  @Column({ name: 'organization_id', type: 'integer', nullable: false })
  organizationId: number;
}
