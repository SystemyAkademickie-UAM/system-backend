import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SessionService } from '../../auth/session/session.service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET, toInternalGroupId } from '../../constants/group-api-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { UserRolesService } from '../../user-roles/user-roles-service';
import { GroupsService } from '../groups-service';
import { CreateGroupFromTemplateDto } from '../dto/create-group-from-template.dto';
import { SaveGroupTemplateDto } from '../dto/save-group-template.dto';
import { GroupTemplatesExportService } from './group-templates-export-service';
import { GroupTemplatesImportService } from './group-templates-import-service';

@Controller('groups')
export class GroupTemplatesController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly groupsService: GroupsService,
    private readonly userRolesService: UserRolesService,
    private readonly exportService: GroupTemplatesExportService,
    private readonly importService: GroupTemplatesImportService,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
  ) {}

  @Post(':groupId/save-as-template')
  @HttpCode(HttpStatus.CREATED)
  async saveAsTemplate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: SaveGroupTemplateDto) {
    const internalGroupId = toInternalGroupId(publicGroupId);

    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const accountId = await this.groupsService.assertLecturerOwnsGroupAndGetAccountId(
      subject.userId,
      internalGroupId);

    const creatorAccountId = await this.resolveTemplateCreatorAccountId(accountId, dto.devCreatorEmail);

    return this.exportService.exportGroupToTemplate(
      internalGroupId,
      creatorAccountId,
      dto.name,
      dto.description,
      dto.isPublic ?? false);
  }

  private async resolveTemplateCreatorAccountId(
    sourceAccountId: number,
    devCreatorEmail?: string,
  ): Promise<number> {
    const normalizedEmail = devCreatorEmail?.trim();
    if (!normalizedEmail) {
      return sourceAccountId;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('devCreatorEmail is not allowed in production');
    }

    const sourceAccount = await this.accountRepository.findOne({ where: { id: sourceAccountId } });
    if (sourceAccount === null) {
      throw new ForbiddenException('Not authorized to manage this group');
    }

    const resolvedAccountId = await this.userRolesService.findLecturerAccountIdByEmailInOrganization(
      normalizedEmail,
      sourceAccount.organizationId,
    );
    if (resolvedAccountId === null) {
      throw new BadRequestException(
        `Lecturer account not found for ${normalizedEmail} in organization ${sourceAccount.organizationId}`,
      );
    }
    return resolvedAccountId;
  }

  @Post('from-template/:templateId')
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Req() req: Request,
    @Body() dto: CreateGroupFromTemplateDto) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    const newGroup = await this.importService.createGroupFromTemplate(
      templateId,
      lecturerAccountId,
      dto.name,
      dto.subjectName);

    return {
      statusCode: HttpStatus.CREATED,
      group: newGroup.id + GROUP_RESPONSE_GROUP_ID_OFFSET,
    };
  }
}
