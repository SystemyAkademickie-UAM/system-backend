import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { AuthTokenSessionService } from '../auth/api-token/auth-token-session-service';
import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly authTokenSessionService: AuthTokenSessionService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AvatarEntity)
    private readonly avatarRepository: Repository<AvatarEntity>,
  ) {}

  /**
   * Retrieves all avatars from the database, ordered by ID ascending.
   */
  async getAvatars(): Promise<AvatarEntity[]> {
    return this.avatarRepository.find({ order: { id: 'ASC' } });
  }

  /**
   * Updates profile settings for the currently logged-in user.
   */
  async updateSettings(req: Request, dto: UpdateProfileSettingsDto): Promise<UserEntity> {
    const subject = await this.authTokenSessionService.resolveSubjectSoftFromRequest(req, dto.auth);
    if (!subject) {
      throw new ForbiddenException('Brak autoryzacji');
    }

    const user = await this.userRepository.findOne({ where: { id: subject.userId } });
    if (!user) {
      throw new NotFoundException('Użytkownik nie istnieje');
    }

    // Optional fields check
    if (dto.nickname !== undefined) {
      const trimmedNickname = dto.nickname.trim();
      if (trimmedNickname === '') {
        throw new ForbiddenException('Pseudonim nie może być pusty');
      }
      user.nickname = trimmedNickname;
    }

    if (dto.avatarId !== undefined) {
      const avatarExists = await this.avatarRepository.findOne({ where: { id: dto.avatarId } });
      if (!avatarExists) {
        throw new NotFoundException(`Awatar o ID ${dto.avatarId} nie istnieje`);
      }
      user.avatarId = dto.avatarId;
    }

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(`Użytkownik id=${user.id} zaktualizował profil (nickname="${user.nickname}", avatarId=${user.avatarId})`);

    return updatedUser;
  }
}
