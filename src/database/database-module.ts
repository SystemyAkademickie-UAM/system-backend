import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  DATABASE_CONNECTION_TIMEOUT_MS_DEFAULT,
  DATABASE_IDLE_TIMEOUT_MS_DEFAULT,
  DATABASE_POOL_MAX_DEFAULT,
} from '../constants/database-pool-constants';
import { resolvePostgresSslOption } from './postgres-ssl.config';

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Registers TypeORM against PostgreSQL (`DATABASE_*`, `TYPEORM_SYNC`).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databasePortRaw = configService.get<string>('DATABASE_PORT', '5432');
        const databasePort = Number.parseInt(databasePortRaw, 10);
        const typeOrmSync = configService.get<string>('TYPEORM_SYNC', 'false');
        const migrationsRun = configService.get<string>('TYPEORM_MIGRATIONS_RUN', 'false') === 'true';
        const ssl = resolvePostgresSslOption((key) => configService.get<string>(key));
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DATABASE_HOST', '127.0.0.1'),
          port: Number.isFinite(databasePort) ? databasePort : 5432,
          username: configService.get<string>('DATABASE_USER', ''),
          password: configService.get<string>('DATABASE_PASSWORD', ''),
          database: configService.get<string>('DATABASE_NAME', ''),
          ssl: ssl === false ? undefined : ssl,
          autoLoadEntities: true,
          synchronize: typeOrmSync === 'true',
          migrations: [join(__dirname, 'migrations', '*.js')],
          migrationsRun,
          extra: {
            max: readPositiveInt(
              configService.get<string>('DATABASE_POOL_MAX'),
              DATABASE_POOL_MAX_DEFAULT,
            ),
            connectionTimeoutMillis: readPositiveInt(
              configService.get<string>('DATABASE_CONNECTION_TIMEOUT_MS'),
              DATABASE_CONNECTION_TIMEOUT_MS_DEFAULT,
            ),
            idleTimeoutMillis: readPositiveInt(
              configService.get<string>('DATABASE_IDLE_TIMEOUT_MS'),
              DATABASE_IDLE_TIMEOUT_MS_DEFAULT,
            ),
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
