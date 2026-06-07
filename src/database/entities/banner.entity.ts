import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { EDUCATION_SCHEMA } from '../../constants/database-schema-constants';

/**
 * Predefined banners dictionary resource (`education.banners`).
 */
@Entity({ schema: EDUCATION_SCHEMA, name: 'banners' })
export class BannerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'image_url', type: 'varchar', length: 255, nullable: false })
  imageUrl: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  name: string;
}
