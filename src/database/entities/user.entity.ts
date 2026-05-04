import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Application user row; extended as the domain grows.
 */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 256, nullable: true })
  email: string | null;
}
