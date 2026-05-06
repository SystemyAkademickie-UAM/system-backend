import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';

import { CreateGroupBodyDto } from './dto/create-group-body.dto';
import { CreateGroupResponseBody, GroupsService } from './groups-service';

/**
 * Course group creation API for lecturers.
 */
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  /**
   * Creates a group row when the caller presents a valid lecturer-bound session.
   */
  @Post('new')
  @HttpCode(HttpStatus.OK)
  createGroup(
    @Headers('x-browser-id') browserId: string | undefined,
    @Body() body: CreateGroupBodyDto,
  ): Promise<CreateGroupResponseBody> {
    return this.groupsService.createGroup(body, browserId);
  }
}
