import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';
import { AUTH_ORGANIZATION_NAME_MAX_LENGTH } from '../../constants/database-entity-constants';

/**
 * Organization tenant (`auth.organizations`); referenced by `auth.accounts.organization_id`.
 */
@Entity({ schema: AUTH_SCHEMA, name: 'organizations' })
export class OrganizationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: AUTH_ORGANIZATION_NAME_MAX_LENGTH })
  name: string;
}
