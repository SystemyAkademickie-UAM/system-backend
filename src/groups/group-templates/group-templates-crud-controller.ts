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
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { SessionService } from '../../auth/session/session.service';
import { GroupsService } from '../groups-service';
import { CloneGroupTemplateDto, GetGroupTemplatesQueryDto, SetGroupTemplateFavoriteDto, UpdateGroupTemplateDto } from '../dto/group-templates-crud.dto';
import { GroupTemplatesCrudService } from './group-templates-crud-service';

@Controller('group-templates')
export class GroupTemplatesCrudController {
  constructor(
    private readonly sessionService: SessionService,
    private readonly groupsService: GroupsService,
    private readonly crudService: GroupTemplatesCrudService) {}

  @Get()
  async getTemplates(
    @Query() query: GetGroupTemplatesQueryDto,
    @Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, query.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    const scope = query.scope || 'public';

    return this.crudService.getTemplates(
      lecturerAccountId,
      scope,
      query.limit || 20,
      query.offset || 0,
      scope === 'public' && Boolean(query.favoritesOnly));
  }

  @Put(':id/favorite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async setTemplateFavorite(
    @Param('id', ParseIntPipe) templateId: number,
    @Body() dto: SetGroupTemplateFavoriteDto,
    @Req() req: Request,
  ) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    await this.crudService.setTemplateFavorite(templateId, lecturerAccountId, dto.favorite);
  }

  @Get(':id')
  async getTemplateDetails(
    @Param('id', ParseIntPipe) templateId: number,
    @Query('auth') auth: string | undefined,
    @Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, auth);
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
    @Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
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
    @Req() req: Request) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    await this.crudService.deleteTemplate(templateId, lecturerAccountId);
  }

  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  async cloneTemplate(
    @Param('id', ParseIntPipe) templateId: number,
    @Body() dto: CloneGroupTemplateDto,
    @Req() req: Request,
  ) {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Missing or invalid session');
    }

    const lecturerAccountId = await this.groupsService.assertLecturerAndGetAccountId(subject.userId);

    return this.crudService.cloneTemplate(templateId, lecturerAccountId, dto.name);
  }
}
