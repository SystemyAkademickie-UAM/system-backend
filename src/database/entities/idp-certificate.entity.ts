import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/**
 * IdP signing certificate for an organization (`auth.idp_certificates`).
 */
@Entity({ schema: AUTH_SCHEMA, name: 'idp_certificates' })
export class IdpCertificateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'organization_id', type: 'integer', nullable: false })
  organizationId: number;

  @Column({ name: 'certificate', type: 'text', nullable: false })
  certificate: string;

  @Column({ name: 'fingerprint', type: 'text', nullable: false })
  fingerprint: string;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
