import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';
import {
  DEFAULT_FAQ_CATEGORY,
  FAQ_CATEGORY_MAX_LENGTH,
  FAQ_QUESTION_MAX_LENGTH,
} from '../../constants/faq-constants';

/**
 * FAQ knowledge base entry entity (`services.faqs`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'faqs' })
export class FaqEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: FAQ_QUESTION_MAX_LENGTH })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: FAQ_CATEGORY_MAX_LENGTH, default: DEFAULT_FAQ_CATEGORY })
  category: string;

  @Column({ name: 'order_index', type: 'integer', default: 0 })
  orderIndex: number;

  @Column({ name: 'is_published', type: 'boolean', default: true })
  isPublished: boolean;

  @Column({ name: 'created_by_user_id', type: 'integer', nullable: true, default: null })
  createdByUserId: number | null;

  @Column({ name: 'updated_by_user_id', type: 'integer', nullable: true, default: null })
  updatedByUserId: number | null;

  @Column({ name: 'created_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  updatedAt: Date;
}

