import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import {
  EDUCATION_GROUP_NAME_MAX_LENGTH,
  EDUCATION_GROUP_VARCHAR_MAX_LENGTH,
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

  /** Optional academic subject name (separate from the fabular group name). */
  @Column({ name: 'subject_name', type: 'varchar', length: EDUCATION_GROUP_NAME_MAX_LENGTH, nullable: true })
  subjectName: string | null;

  @Column({ name: 'image_ref', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  imageRef: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'currency', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  currency: string | null;

  /** ASCII emoji representing the group currency (e.g. "🥕"). */
  @Column({ name: 'currency_emoji', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  currencyEmoji: string | null;

  @Column({ name: 'lives', type: 'integer', nullable: true, default: 3 })
  lives: number | null;

  @Column({ name: 'starting_lives', type: 'integer', nullable: true, default: 3 })
  startingLives: number | null;

  @Column({ name: 'lives_icon', type: 'varchar', length: EDUCATION_GROUP_VARCHAR_MAX_LENGTH, nullable: true })
  livesIcon: string | null;

  /** Master toggle for the lives system (default off). */
  @Column({ name: 'lives_enabled', type: 'boolean', default: false })
  livesEnabled: boolean;

  /** Custom display name for lives (e.g. "Tarcze", "Serca"). */
  @Column({ name: 'lives_label', type: 'varchar', length: 100, nullable: true })
  livesLabel: string | null;

  /** Whether "extra life" appears automatically as a shop product. */
  @Column({ name: 'lives_shop_enabled', type: 'boolean', default: false })
  livesShopEnabled: boolean;

  @Column({ name: 'shop_open', type: 'boolean', default: true })
  shopOpen: boolean;

  @Column({ name: 'shop_opens_at', type: 'timestamptz', nullable: true })
  shopOpensAt: Date | null;

  @Column({ name: 'rank_show_member_avatars', type: 'boolean', default: true })
  rankShowMemberAvatars: boolean;
}
