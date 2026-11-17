import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { AccountEntity } from '../database/entities/account.entity';
import { EnrollmentEntity } from '../database/entities/enrollment.entity';
import { GroupEntity } from '../database/entities/group.entity';
import { OrganizationLogEntity } from '../database/entities/organization-log.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { OrganizationLogArchiveReader } from './organization-log-archive.reader';
import { OrganizationLogController } from './organization-log.controller';
import { OrganizationLogInboxReader } from './organization-log-inbox.reader';
import { OrganizationLogLinksReader } from './organization-log-links.reader';
import { OrganizationLogQueryService } from './organization-log-query.service';
import { OrganizationLogService } from './organization-log.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationLogEntity,
      AccountEntity,
      UserEntity,
      GroupEntity,
      EnrollmentEntity,
    ]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [OrganizationLogController],
  providers: [
    OrganizationLogService,
    OrganizationLogQueryService,
    OrganizationLogArchiveReader,
    OrganizationLogInboxReader,
    OrganizationLogLinksReader,
  ],
  exports: [OrganizationLogService],
})
export class OrganizationLogModule {}
