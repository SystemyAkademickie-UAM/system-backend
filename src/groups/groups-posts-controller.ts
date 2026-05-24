import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { CreatePostDto } from './dto/create-post.dto';
import {
  CreatePostResponseBody,
  GetPostsResponseBody,
  GroupsPostsService,
} from './groups-posts-service';

@Controller('groups')
export class GroupsPostsController {
  constructor(private readonly groupsPostsService: GroupsPostsService) {}

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  createPost(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: CreatePostDto,
  ): Promise<CreatePostResponseBody> {
    return this.groupsPostsService.createPost(req, groupId, body, browserId);
  }

  @Get(':id/post')
  @HttpCode(HttpStatus.OK)
  getPosts(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth?: string,
  ): Promise<GetPostsResponseBody> {
    return this.groupsPostsService.getPosts(req, groupId, browserId, auth);
  }

  /** Alias for plural /posts just in case frontend prefers plural */
  @Get(':id/posts')
  @HttpCode(HttpStatus.OK)
  getPostsAlias(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Query('auth') auth?: string,
  ): Promise<GetPostsResponseBody> {
    return this.groupsPostsService.getPosts(req, groupId, browserId, auth);
  }
}
