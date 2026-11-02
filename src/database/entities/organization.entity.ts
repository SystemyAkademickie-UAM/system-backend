import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';
import {
  AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH,
  AUTH_ORGANIZATION_NAME_MAX_LENGTH,
  AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import {
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../constants/organization-constants';

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
    name: 'login_method',
    type: 'varchar',
    length: 16,
    nullable: false,
    default: ORGANIZATION_LOGIN_METHOD_SAML,
  })
  loginMethod: string;

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

  @Column({ name: 'domain', type: 'varchar', length: AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH, nullable: true })
  domain: string | null;

  @Column({
    name: 'representative_full_name',
    type: 'varchar',
    length: AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH,
    nullable: true,
  })
  representativeFullName: string | null;

  @Column({
    name: 'representative_email',
    type: 'varchar',
    length: AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
    nullable: true,
  })
  representativeEmail: string | null;

  @Column({
    name: 'representative_phone',
    type: 'varchar',
    length: AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
    nullable: true,
  })
  representativePhone: string | null;

  @Column({
    name: 'address_town',
    type: 'varchar',
    length: AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH,
    nullable: true,
  })
  addressTown: string | null;

  @Column({
    name: 'address_street',
    type: 'varchar',
    length: AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH,
    nullable: true,
  })
  addressStreet: string | null;

  @Column({
    name: 'address_building',
    type: 'varchar',
    length: AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH,
    nullable: true,
  })
  addressBuilding: string | null;

  @Column({
    name: 'address_postal_code',
    type: 'varchar',
    length: AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH,
    nullable: true,
  })
  addressPostalCode: string | null;

  @Column({
    name: 'address_country',
    type: 'varchar',
    length: AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH,
    nullable: true,
  })
  addressCountry: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
