import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';
import {
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_NAME_MAX_LENGTH,
} from '../../constants/database-entity-constants';

/**
 * Organization tenant (`auth.organizations`); referenced by `auth.accounts.organization_id`.
 */
@Entity({ schema: AUTH_SCHEMA, name: 'organizations' })
export class OrganizationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: AUTH_ORGANIZATION_NAME_MAX_LENGTH })
  name: string;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
    nullable: true,
  })
  contactPhone: string | null;

  @Column({ name: 'entity_id', type: 'text', nullable: true })
  entityId: string | null;

  @Column({ name: 'metadata_url', type: 'text', nullable: true })
  metadataUrl: string | null;

  @Column({ name: 'sso_login_url', type: 'text', nullable: true })
  ssoLoginUrl: string | null;

  @Column({ name: 'sso_logout_url', type: 'text', nullable: true })
  ssoLogoutUrl: string | null;

  @Column({ name: 'certificate_id', type: 'integer', nullable: true })
  certificateId: number | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
