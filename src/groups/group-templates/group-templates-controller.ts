import { Body, Controller, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../../auth/api-token/auth-token-session-service';
import { GroupsService } from '../groups-service';
import { GroupTemplatesExportService } from './group-templates-export-service';
import { toInternalGroupId } from '../../constants/group-api-constants';

@Controller('groups')
export class GroupTemplatesController {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly groupsService: GroupsService, // Do weryfikacji uprawnień (lub inna metoda)
    private readonly exportService: GroupTemplatesExportService,
  ) {}

  @Post(':groupId/save-as-template')
  @HttpCode(HttpStatus.CREATED)
  async saveAsTemplate(
    @Param('groupId', ParseIntPipe) publicGroupId: number,
    @Req() req: Request,
    @Body() body: {
      auth?: string;
      name: string;
      description?: string;
      isPublic?: boolean;
    },
  ) {
    const internalGroupId = toInternalGroupId(publicGroupId);
    
    // Autoryzacja - pobieramy subject
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, body.auth);
    if (!subject) {
      throw new Error('Unauthorized'); // Można rzucić ForbiddenException
    }

    // Weryfikacja czy user to wykładowca i właściciel grupy
    // groupsService ma metody pomocnicze, ale możemy po prostu użyć istniejącej asercji z GroupsService
    const accountId = await this.groupsService.assertLecturerOwnsGroupAndGetAccountId(
      subject.userId,
      internalGroupId,
    );

    return this.exportService.exportGroupToTemplate(
      internalGroupId,
      accountId,
      body.name,
      body.description,
      body.isPublic ?? false,
    );
  }
}
