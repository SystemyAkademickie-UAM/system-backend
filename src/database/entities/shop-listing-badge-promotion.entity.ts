import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

@Entity({ schema: GAMIFICATION_SCHEMA, name: 'shop_listing_badge_promotions' })
export class ShopListingBadgePromotionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shop_listing_id', type: 'integer', nullable: false })
  shopListingId: number;

  @Column({ name: 'badge_id', type: 'integer', nullable: false })
  badgeId: number;

  @Column({ name: 'promotion_type', type: 'varchar', length: 20, nullable: false })
  promotionType: string;

  @Column({ name: 'value', type: 'integer', nullable: false })
  value: number;
}
