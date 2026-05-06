import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
        return {
          type: 'postgres' as const,
          host: configService.get<string>('DATABASE_HOST', '127.0.0.1'),
          port: Number.isFinite(databasePort) ? databasePort : 5432,
          username: configService.get<string>('DATABASE_USER', 'postgres'),
          password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
          database: configService.get<string>('DATABASE_NAME', 'maq'),
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
