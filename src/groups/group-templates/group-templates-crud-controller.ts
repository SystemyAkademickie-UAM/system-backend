import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthTokenSessionService } from '../../auth/api-token/auth-token-session-service';
import { GroupsService } from '../groups-service';
import { GetGroupTemplatesQueryDto, UpdateGroupTemplateDto } from '../dto/group-templates-crud.dto';
import { GroupTemplatesCrudService } from './group-templates-crud-service';

@Controller('group-templates')
export class GroupTemplatesCrudController {
  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    private readonly groupsService: GroupsService,
    private readonly crudService: GroupTemplatesCrudService,
  ) {}

  @Get()
  async getTemplates(
    @Query() query: GetGroupTemplatesQueryDto,
    @Req() req: Request,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, query.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    return this.crudService.getTemplates(
      lecturerAccountId,
      query.scope || 'public',
      query.limit || 20,
      query.offset || 0,
    );
  }

  @Get(':id')
  async getTemplateDetails(
    @Param('id', ParseIntPipe) templateId: number,
    @Query('auth') auth: string | undefined,
    @Req() req: Request,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    return this.crudService.getTemplateDetails(templateId, lecturerAccountId);
  }

  @Patch(':id')
  async updateTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Body() dto: UpdateGroupTemplateDto,
    @Req() req: Request,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    return this.crudService.updateTemplate(templateId, lecturerAccountId, {
      name: dto.name,
      description: dto.description,
      isPublic: dto.isPublic,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Body('auth') auth: string | undefined,
    @Req() req: Request,
  ) {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    await this.crudService.deleteTemplate(templateId, lecturerAccountId);
  }
}
