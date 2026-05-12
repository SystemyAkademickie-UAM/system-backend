import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_ACCOUNT_ROLE_MAX_LENGTH } from '../../constants/database-entity-constants';
import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/**
 * User membership in an organization with a role (`auth.accounts`).
 */
@Entity({ schema: AUTH_SCHEMA, name: 'accounts' })
export class AccountEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'integer', nullable: false })
  @Index()
  userId: number;

  @Column({ name: 'organization_id', type: 'integer', nullable: false })
  organizationId: number;

  @Column({ name: 'role', type: 'varchar', length: AUTH_ACCOUNT_ROLE_MAX_LENGTH, nullable: false })
  role: string;
}
