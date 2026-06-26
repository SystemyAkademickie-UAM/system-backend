import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import { SessionService } from '../auth/session/session.service';
import { USER_NICKNAME_MAX_LENGTH } from '../constants/user-profile-constants';
import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { UpdateProfileSettingsDto } from './dto/update-profile-settings.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly sessionService: SessionService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AvatarEntity)
    private readonly avatarRepository: Repository<AvatarEntity>) {}

  /**
   * Retrieves all avatars from the database, ordered by ID ascending.
   */
  async getAvatars(): Promise<AvatarEntity[]> {
    return this.avatarRepository.find({ order: { id: 'ASC' } });
  }

  /**
   * Retrieves profile settings for the currently logged-in user.
   */
  async getProfile(req: Request, auth?: string): Promise<UserEntity> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, auth);
    if (!subject) {
      throw new ForbiddenException('Brak autoryzacji');
    }

    const user = await this.userRepository.findOne({ where: { id: subject.userId } });
    if (!user) {
      throw new NotFoundException('Użytkownik nie istnieje');
    }

    return user;
  }

  /**
   * Updates profile settings for the currently logged-in user.
   */
  async updateSettings(req: Request, dto: UpdateProfileSettingsDto): Promise<UserEntity> {
    const subject = await this.sessionService.resolveSubjectFromRequest(req, dto.auth);
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
      if (trimmedNickname.length > USER_NICKNAME_MAX_LENGTH) {
        throw new ForbiddenException(
          `Pseudonim może mieć co najwyżej ${USER_NICKNAME_MAX_LENGTH} znaków`,
        );
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

    if (dto.showNickname !== undefined) {
      user.showNickname = dto.showNickname;
    }

    const updatedUser = await this.userRepository.save(user);
    this.logger.log(
      `Użytkownik id=${user.id} zaktualizował profil (nickname="${user.nickname}", avatarId=${user.avatarId}, showNickname=${user.showNickname})`,
    );

    return updatedUser;
  }
}
