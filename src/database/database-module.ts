import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { resolvePostgresSslOption } from './postgres-ssl.config';

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
        // Auto-aplikacja migracji na starcie:
        //  - w `production` musi być jawnie włączona (`TYPEORM_MIGRATIONS_RUN=true`),
        //  - w pozostałych trybach (dev/test/docker-compose) domyślnie ON, żeby świeżo
        //    zbudowany kontener / nowy klon repo nie wymagał ręcznego puszczania CLI.
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const migrationsRunRaw = configService.get<string>('TYPEORM_MIGRATIONS_RUN');
        const migrationsRun =
          migrationsRunRaw !== undefined
            ? migrationsRunRaw === 'true'
            : nodeEnv !== 'production';
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
        };
      },
    }),
  ],
})
export class DatabaseModule {}
