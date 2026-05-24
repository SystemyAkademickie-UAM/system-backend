import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Announcement / post for a course group (`education.posts`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'posts' })
export class PostEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to `education.groups.id`. */
  @Column({ name: 'group_id', type: 'integer', nullable: true })
  groupId: number | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;
}
