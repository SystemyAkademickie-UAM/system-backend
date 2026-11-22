import type { MigrationInterface, QueryRunner } from 'typeorm';

import {
  AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH,
  AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH,
  AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH,
  AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH,
  AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH,
} from '../../constants/database-entity-constants';

const UP_SQL = `
ALTER TABLE auth.organizations
  ADD COLUMN IF NOT EXISTS domain character varying(${AUTH_ORGANIZATION_DOMAIN_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS representative_full_name character varying(${AUTH_ORGANIZATION_REPRESENTATIVE_NAME_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS representative_email character varying(${AUTH_ORGANIZATION_CONTACT_EMAIL_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS representative_phone character varying(${AUTH_ORGANIZATION_CONTACT_PHONE_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS address_town character varying(${AUTH_ORGANIZATION_ADDRESS_TOWN_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS address_street character varying(${AUTH_ORGANIZATION_ADDRESS_STREET_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS address_building character varying(${AUTH_ORGANIZATION_ADDRESS_BUILDING_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS address_postal_code character varying(${AUTH_ORGANIZATION_ADDRESS_POSTAL_CODE_MAX_LENGTH}),
  ADD COLUMN IF NOT EXISTS address_country character varying(${AUTH_ORGANIZATION_ADDRESS_COUNTRY_MAX_LENGTH});

CREATE UNIQUE INDEX IF NOT EXISTS organizations_domain_uidx
  ON auth.organizations (domain)
  WHERE domain IS NOT NULL;
`.trim();

const DOWN_SQL = `
DROP INDEX IF EXISTS auth.organizations_domain_uidx;

ALTER TABLE auth.organizations
  DROP COLUMN IF EXISTS address_country,
  DROP COLUMN IF EXISTS address_postal_code,
  DROP COLUMN IF EXISTS address_building,
  DROP COLUMN IF EXISTS address_street,
  DROP COLUMN IF EXISTS address_town,
  DROP COLUMN IF EXISTS representative_phone,
  DROP COLUMN IF EXISTS representative_email,
  DROP COLUMN IF EXISTS representative_full_name,
  DROP COLUMN IF EXISTS domain;
`.trim();

/**
 * Migration 029 — domain, representative, and postal address on `auth.organizations`.
 * Existing rows stay null. Create requires the values and writes them.
 */
export class OrganizationProfile0000000000029 implements MigrationInterface {
  name = 'OrganizationProfile0000000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(UP_SQL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DOWN_SQL);
  }
}
