import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { ProfileService } from './profile-service';

@ApiTags('Profile')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * GET /profile/avatars
   * Returns list of all available avatars.
   */
  @Get('avatars')
  @ApiOperation({ summary: 'List all available avatars' })
  async getAvatars() {
    return this.profileService.getAvatars();
  }

  /**
   * GET /profile
   * Returns current user's profile info.
   */
  @Get()
  @ApiOperation({ summary: "Get the current user's profile info" })
  async getProfile(@Req() req: Request) {
    return this.profileService.getProfile(req);
  }

  /**
   * PATCH /profile/settings
   * Updates settings (nickname/avatarId) for the logged-in user.
   */
  @Patch('settings')
  @ApiOperation({ summary: 'Update settings (nickname/avatarId) for the logged-in user' })
  async updateSettings(@Req() req: Request, @Body() dto: UpdateProfileSettingsDto) {
    return this.profileService.updateSettings(req, dto);
  }
}
