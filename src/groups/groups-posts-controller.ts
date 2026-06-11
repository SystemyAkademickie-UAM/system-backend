import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { CreatePostDto } from './dto/create-post.dto';
import {
  CreatePostResponseBody,
  DeletePostResponseBody,
  GetPostsResponseBody,
  GroupsPostsService,
  UpdatePostResponseBody,
} from './groups-posts-service';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('Group posts')
@Controller('groups')
export class GroupsPostsController {
  constructor(private readonly groupsPostsService: GroupsPostsService) {}

  @Post(':id/post')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a post in the given course group' })
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
  @ApiOperation({ summary: 'Get posts for the given course group' })
  getPosts(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<GetPostsResponseBody> {
    return this.groupsPostsService.getPosts(req, groupId, browserId);
  }

  /** Alias for plural /posts just in case frontend prefers plural */
  @Get(':id/posts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get posts for the given course group (plural alias)' })
  getPostsAlias(
    @Param('id', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ): Promise<GetPostsResponseBody> {
    return this.groupsPostsService.getPosts(req, groupId, browserId);
  }

  /**
   * Deletes a post belonging to the given course group.
   * DELETE /groups/:id/post/:postId
   */
  @Delete(':id/post/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a post belonging to the given course group' })
  deletePost(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: { auth?: string } = {},
  ): Promise<DeletePostResponseBody> {
    return this.groupsPostsService.deletePost(req, groupId, postId, browserId, body?.auth);
  }

  /**
   * Updates a post belonging to the given course group.
   * PATCH /groups/:id/post/:postId
   */
  @Patch(':id/post/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a post belonging to the given course group' })
  updatePost(
    @Param('id', ParseIntPipe) groupId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: UpdatePostDto,
  ): Promise<UpdatePostResponseBody> {
    return this.groupsPostsService.updatePost(req, groupId, postId, body, browserId);
  }
}
