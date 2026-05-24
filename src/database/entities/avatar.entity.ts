import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { AUTH_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Avatar dictionary resource (`auth.avatars`).
 */
@Entity({ schema: AUTH_SCHEMA, name: 'avatars' })
export class AvatarEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: false })
  imageUrl: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;
}
