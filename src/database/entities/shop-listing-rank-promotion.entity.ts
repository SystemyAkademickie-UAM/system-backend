import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

@Entity({ schema: GAMIFICATION_SCHEMA, name: 'shop_listing_rank_promotions' })
export class ShopListingRankPromotionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shop_listing_id', type: 'integer', nullable: false })
  shopListingId: number;

  @Column({ name: 'rank_id', type: 'integer', nullable: false })
  rankId: number;

  @Column({ name: 'promotion_type', type: 'varchar', length: 20, nullable: false })
  promotionType: string;

  @Column({ name: 'value', type: 'integer', nullable: false })
  value: number;
}
