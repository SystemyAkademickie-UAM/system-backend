import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import {
  EDUCATION_GROUP_NAME_MAX_LENGTH,
  EDUCATION_GROUP_VARCHAR_MAX_LENGTH,
  EDUCATION_GROUP_ENTRY_CODE_MAX_LENGTH,
} from '../../constants/database-entity-constants';
import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Course / campaign group (`education.groups`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'groups' })
export class GroupEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Leading organizer: `auth.accounts.id` for the lecturer role. */
  @Column({ name: 'teacher_account_id', type: 'integer', nullable: false })
  teacherAccountId: number;

  @Column({ name: 'name', type: 'varchar', length: EDUCATION_GROUP_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'image_ref', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  imageRef: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'currency', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  currency: string | null;

  @Column({ name: 'currency_icon', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  currencyIcon: string | null;

  @Column({ name: 'lives', type: 'integer', nullable: true, default: 3 })
  lives: number | null;

  @Column({ name: 'lives_icon', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  livesIcon: string | null;

  /** Join / enrollment code. */
  @Column({ name: 'entry_code', type: 'varchar', length: EDUCATION_GROUP_ENTRY_CODE_MAX_LENGTH, nullable: true })
  entryCode: string | null;
}
