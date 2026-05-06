import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AuthTokenEntity } from './entities/auth-token.entity';
import { GroupEntity } from './entities/group.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserEntity } from './entities/user.entity';

const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10);

const isTypeScriptContext = __filename.endsWith('.ts');

/**
 * CLI-only DataSource for `typeorm migration:*` (Nest bootstraps TypeORM separately via DatabaseModule).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: Number.isFinite(parsedPort) ? parsedPort : 5432,
  username: process.env.DATABASE_USER ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'maq',
  entities: [UserEntity, AuthTokenEntity, UserRoleEntity, GroupEntity],
  migrations: [join(__dirname, 'migrations', isTypeScriptContext ? '*.ts' : '*.js')],
  synchronize: false,
});
