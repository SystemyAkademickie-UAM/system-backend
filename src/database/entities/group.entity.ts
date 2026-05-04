import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Course / campaign group with gamification labels (currency, lives).
 */
@Entity('groups')
export class GroupEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 256 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 128 })
  currency: string;

  @Column({ name: 'currency_icon' })
  currencyIcon: number;

  @Column({ type: 'varchar', length: 128 })
  life: string;

  @Column({ name: 'life_icon' })
  lifeIcon: number;

  @Column({ name: 'banner_ref', type: 'varchar', length: 128, nullable: true })
  bannerRef: string | null;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId: number | null;
}
