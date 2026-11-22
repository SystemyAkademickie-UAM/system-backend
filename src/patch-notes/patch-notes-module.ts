import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { PatchNoteEntity } from '../database/entities/patch-note.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminPatchNotesController } from './admin-patch-notes-controller';
import { PatchNotesAccessService } from './patch-notes-access-service';
import { PatchNotesController } from './patch-notes-controller';
import { PatchNotesService } from './patch-notes-service';

/**
 * Module providing superadmin patch notes PDF management and user-facing PDF access.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PatchNoteEntity]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [AdminPatchNotesController, PatchNotesController],
  providers: [PatchNotesService, PatchNotesAccessService],
  exports: [PatchNotesService],
})
export class PatchNotesModule {}

