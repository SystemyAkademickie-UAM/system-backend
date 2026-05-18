import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AccountEntity } from './entities/account.entity';
import { AuthTokenEntity } from './entities/auth-token.entity';
import { BadgeEntity } from './entities/badge.entity';
import { DriveEntity } from './entities/drive.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';
import { GroupEntity } from './entities/group.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { RankEntity } from './entities/rank.entity';
import { UserEntity } from './entities/user.entity';
import { resolvePostgresSslOption } from './postgres-ssl.config';

const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '5432', 10);

const ssl = resolvePostgresSslOption((key) => process.env[key]);

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
  database: process.env.DATABASE_NAME ?? 's494657_proj',
  ssl: ssl === false ? undefined : ssl,
  entities: [
    UserEntity,
    AuthTokenEntity,
    AccountEntity,
    OrganizationEntity,
    GroupEntity,
    EnrollmentEntity,
    DriveEntity,
    BadgeEntity,
    RankEntity,
  ],
  migrations: [join(__dirname, 'migrations', isTypeScriptContext ? '*.ts' : '*.js')],
  synchronize: false,
});
