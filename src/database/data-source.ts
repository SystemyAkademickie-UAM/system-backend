import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

import { AccountEntity } from './entities/account.entity';
import { AuthTokenEntity } from './entities/auth-token.entity';
import { AvatarEntity } from './entities/avatar.entity';
import { BadgeEntity } from './entities/badge.entity';
import { DriveEntity } from './entities/drive.entity';
import { EnrollmentEntity } from './entities/enrollment.entity';
import { GroupEntity } from './entities/group.entity';
import { OrganizationEntity } from './entities/organization.entity';
import { RankEntity } from './entities/rank.entity';
import { UserEntity } from './entities/user.entity';
import { resolvePostgresSslOption } from './postgres-ssl.config';
import { assertDatabaseEnv } from '../validate-env';

assertDatabaseEnv();

const parsedPort = Number.parseInt(process.env.DATABASE_PORT ?? '', 10);
if (!Number.isFinite(parsedPort)) {
  throw new Error('DATABASE_PORT must be a valid integer');
}

const ssl = resolvePostgresSslOption((key) => process.env[key]);

const isTypeScriptContext = __filename.endsWith('.ts');

/**
 * CLI-only DataSource for `typeorm migration:*` (Nest bootstraps TypeORM separately via DatabaseModule).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: parsedPort,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: ssl === false ? undefined : ssl,
  entities: [
    UserEntity,
    AuthTokenEntity,
    AvatarEntity,
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
