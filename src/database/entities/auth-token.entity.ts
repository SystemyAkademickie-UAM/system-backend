import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Long-lived auth token bound to a browser installation.
 */
@Entity('auth_tokens')
export class AuthTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 512, unique: true })
  token: string;

  @Column({ name: 'browser_uuid', type: 'varchar', length: 64 })
  browserUuid: string;

  @Column({ name: 'user_id' })
  userId: number;
}
