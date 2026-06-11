import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { GAMIFICATION_SCHEMA } from '../../constants/database-schema-constants';

@Entity({ schema: GAMIFICATION_SCHEMA, name: 'shop_listings' })
export class ShopListingEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'item_id', type: 'integer', nullable: false, unique: true })
  itemId: number;

  @Column({ name: 'base_price', type: 'integer', nullable: false })
  basePrice: number;

  @Column({ name: 'stock_quantity', type: 'integer', nullable: true })
  stockQuantity: number | null;

  @Column({ name: 'per_student_limit', type: 'integer', nullable: true })
  perStudentLimit: number | null;
}
