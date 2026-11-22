import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { SystemDocumentEntity } from '../database/entities/system-document.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminDocumentsController } from './admin-documents-controller';
import { DocumentsAccessService } from './documents-access-service';
import { DocumentsController } from './documents-controller';
import { DocumentsService } from './documents-service';

/**
 * Module providing superadmin management and public access for application PDF documents.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SystemDocumentEntity]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [AdminDocumentsController, DocumentsController],
  providers: [DocumentsService, DocumentsAccessService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

