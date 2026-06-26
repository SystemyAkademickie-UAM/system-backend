import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AvatarEntity } from '../database/entities/avatar.entity';
import { UserEntity } from '../database/entities/user.entity';
import { USER_NICKNAME_MAX_LENGTH } from '../constants/user-profile-constants';

export interface RegistrationStatusResponse {
  userId: number;
  email: string;
  nickname: string;
  avatarId: number;
  registrationCompleted: boolean;
  eulaAccepted: boolean;
  profileSubmitted: boolean;
}

export interface UpdateProfileResponse {
  success: boolean;
  nickname: string;
  avatarId: number;
}

export interface AcceptEulaResponse {
  success: boolean;
  eulaAcceptedAt: string;
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(AvatarEntity)
    private readonly avatarRepository: Repository<AvatarEntity>) {}

  async getRegistrationStatus(userId: number): Promise<RegistrationStatusResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return {
      userId: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarId: user.avatarId,
      registrationCompleted: user.registrationCompleted,
      eulaAccepted: user.eulaAcceptedAt !== null,
      profileSubmitted: user.profileSubmittedAt !== null,
    };
  }

  async updateProfile(
    userId: number,
    nickname: string,
    avatarId: number): Promise<UpdateProfileResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
      throw new BadRequestException('Nickname cannot be empty');
    }
    if (trimmedNickname.length > USER_NICKNAME_MAX_LENGTH) {
      throw new BadRequestException(
        `Nickname must be at most ${USER_NICKNAME_MAX_LENGTH} characters`,
      );
    }
    await this.assertAvatarExists(avatarId);
    user.nickname = trimmedNickname;
    user.avatarId = avatarId;
    user.profileSubmittedAt = new Date();
    await this.userRepository.save(user);
    this.logger.log(`User ${userId} profile updated: nickname="${trimmedNickname}", avatarId=${avatarId}`);
    return {
      success: true,
      nickname: trimmedNickname,
      avatarId,
    };
  }

  async acceptEula(userId: number): Promise<AcceptEulaResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    if (user.profileSubmittedAt === null || user.nickname.trim().length === 0) {
      throw new BadRequestException('Complete your profile before accepting the EULA');
    }
    const now = new Date();
    user.eulaAcceptedAt = now;
    user.registrationCompleted = true;
    await this.userRepository.save(user);
    this.logger.log(`User ${userId} accepted EULA at ${now.toISOString()}`);
    return {
      success: true,
      eulaAcceptedAt: now.toISOString(),
    };
  }

  private async assertAvatarExists(avatarId: number): Promise<void> {
    const avatar = await this.avatarRepository.findOne({ where: { id: avatarId } });
    if (avatar === null) {
      throw new BadRequestException(`Avatar ${avatarId} does not exist`);
    }
  }
}
