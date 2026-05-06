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

  /** SAML `NameID` / JWT `sub` for linking institutional identity (unique when set). */
  @Column({ name: 'saml_name_id', type: 'varchar', length: 512, nullable: true, unique: true })
  samlNameId: string | null;
}
