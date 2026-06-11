import { Controller, Get, Param, ParseIntPipe, Req, Headers } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { StudentProfileService } from './student-profile-service';

@ApiTags('Student profile')
@Controller('groups')
export class StudentProfileController {
  constructor(private readonly studentProfileService: StudentProfileService) {}

  /**
   * Retrieves the student profile scoped to a specific group.
   * Based on Nikita's PR feedback: Profile depends on the group enrollment, not just the index number.
   */
  @Get(':groupId/student-profile')
  @ApiOperation({ summary: 'Retrieve the student profile scoped to a specific group' })
  getProfile(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req: Request,
    @Headers('x-browser-id') browserId: string | undefined,
  ) {
    return this.studentProfileService.getStudentProfile(req, groupId, browserId);
  }
}
