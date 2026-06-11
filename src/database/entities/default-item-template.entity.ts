import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { GAMIFICATION_BADGE_NAME_MAX_LENGTH } from '../../constants/database-entity-constants';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

@Entity({ schema: GAMIFICATION_SCHEMA, name: 'default_item_templates' })
export class DefaultItemTemplateEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: GAMIFICATION_BADGE_NAME_MAX_LENGTH, nullable: false })
  name: string;

  @Column({ name: 'story_description', type: 'text', nullable: true })
  storyDescription: string | null;

  @Column({ name: 'educational_description', type: 'text', nullable: true })
  educationalDescription: string | null;

  @Column({ name: 'base_price', type: 'integer', nullable: false })
  basePrice: number;
}
