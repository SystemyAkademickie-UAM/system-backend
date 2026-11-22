import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SessionModule } from '../auth/session/session.module';
import { FaqEntity } from '../database/entities/faq.entity';
import { UserRolesModule } from '../user-roles/user-roles-module';
import { AdminFaqController } from './admin-faq-controller';
import { FaqAccessService } from './faq-access-service';
import { FaqController } from './faq-controller';
import { FaqService } from './faq-service';

/**
 * Module providing FAQ knowledge base administration and public user access.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FaqEntity]),
    SessionModule,
    UserRolesModule,
  ],
  controllers: [AdminFaqController, FaqController],
  providers: [FaqService, FaqAccessService],
  exports: [FaqService],
})
export class FaqModule {}

