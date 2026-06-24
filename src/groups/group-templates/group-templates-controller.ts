import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../../auth/session/session.service';
import { GROUP_RESPONSE_GROUP_ID_OFFSET, toInternalGroupId } from '../../constants/group-api-constants';
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
    private readonly exportService: GroupTemplatesExportService,
    private readonly importService: GroupTemplatesImportService) {}

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

    return this.exportService.exportGroupToTemplate(
      internalGroupId,
      accountId,
      dto.name,
      dto.description,
      dto.isPublic ?? false);
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
