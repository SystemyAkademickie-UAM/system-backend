import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Assigns named roles to users (multi-role supported).
 */
@Entity('user_roles')
@Unique(['userId', 'role'])
export class UserRoleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 64 })
  role: string;
}
