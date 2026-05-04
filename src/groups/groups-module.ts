import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GroupEntity } from '../database/entities/group.entity';
import { LecturerAuthModule } from '../lecturer-auth/lecturer-auth-module';
import { GroupsController } from './groups-controller';
import { GroupsService } from './groups-service';

@Module({
  imports: [TypeOrmModule.forFeature([GroupEntity]), LecturerAuthModule],
  controllers: [GroupsController],
  providers: [GroupsService],
})
export class GroupsModule {}
