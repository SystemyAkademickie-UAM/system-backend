import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Per-lecturer favorite marker for a public group template (`education.group_template_favorites`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'group_template_favorites' })
export class GroupTemplateFavoriteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer', nullable: false })
  accountId: number;

  @Column({ name: 'template_id', type: 'integer', nullable: false })
  templateId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
