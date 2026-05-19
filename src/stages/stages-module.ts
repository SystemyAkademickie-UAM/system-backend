import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthTokenSessionModule } from '../auth/api-token/auth-token-session-module';
import { GroupEntity } from '../database/entities/group.entity';
import { StageEntity } from '../database/entities/stage.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { StagesController } from './stages-controller';
import { StagesService } from './stages-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([StageEntity, GroupEntity]),
    AuthTokenSessionModule,
    UserRolesModule,
  ],
  controllers: [StagesController],
  providers: [StagesService],
  exports: [StagesService],
})
export class StagesModule {}
