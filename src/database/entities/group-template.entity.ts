import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';
import type { GroupTemplateData } from '../../groups/group-templates/group-template-data.interface';

@Entity({ schema: EDUCATION_SCHEMA, name: 'group_templates' })
export class GroupTemplateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ name: 'creator_account_id', type: 'integer', nullable: false })
  creatorAccountId: number;

  @Column({ name: 'base_group_id', type: 'integer', nullable: true })
  baseGroupId: number | null;

  @Column({ name: 'data', type: 'jsonb', nullable: false })
  data: GroupTemplateData;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
