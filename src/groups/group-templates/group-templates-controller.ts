import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../../auth/api-token/auth-token-session-service';
import { toInternalGroupId } from '../../constants/group-api-constants';
import { GroupsService } from '../groups-service';
import { SaveGroupTemplateDto } from '../dto/save-group-template.dto';
import { GroupTemplatesExportService } from './group-templates-export-service';

@Controller('groups')
export class GroupTemplatesController {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly groupsService: GroupsService,
    private readonly exportService: GroupTemplatesExportService,
  ) {}

  @Post(':groupId/save-as-template')
  @HttpCode(HttpStatus.CREATED)
  async saveAsTemplate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() dto: SaveGroupTemplateDto,
  ) {
    const internalGroupId = toInternalGroupId(publicGroupId);

    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const accountId = await this.groupsService.assertLecturerOwnsGroupAndGetAccountId(
      subject.userId,
      internalGroupId,
    );

    return this.exportService.exportGroupToTemplate(
      internalGroupId,
      accountId,
      dto.name,
      dto.description,
      dto.isPublic ?? false,
    );
  }
}
