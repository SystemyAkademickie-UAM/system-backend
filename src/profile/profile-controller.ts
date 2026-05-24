import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';

import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';
import { ProfileService } from './profile-service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  /**
   * GET /profile/avatars
   * Returns list of all available avatars.
   */
  @Get('avatars')
  async getAvatars() {
    return this.profileService.getAvatars();
  }

  /**
   * PATCH /profile/settings
   * Updates settings (nickname/avatarId) for the logged-in user.
   */
  @Patch('settings')
  async updateSettings(@Req() req: Request, @Body() dto: UpdateProfileSettingsDto) {
    return this.profileService.updateSettings(req, dto);
  }
}
