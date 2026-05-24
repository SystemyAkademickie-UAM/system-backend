import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserEntity } from '../database/entities/user.entity';
import { AUTH_USER_NAME_FIELD_MAX_LENGTH } from '../constants/database-entity-constants';

export interface RegistrationStatusResponse {
  userId: number;
  email: string;
  nickname: string;
  avatarId: number;
  registrationCompleted: boolean;
  eulaAccepted: boolean;
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

function truncateField(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

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
    };
  }

  async updateProfile(
    userId: number,
    nickname: string,
    avatarId: number,
  ): Promise<UpdateProfileResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    const trimmedNickname = truncateField(nickname.trim(), AUTH_USER_NAME_FIELD_MAX_LENGTH);
    if (trimmedNickname.length === 0) {
      throw new Error('Nickname cannot be empty');
    }
    user.nickname = trimmedNickname;
    user.avatarId = avatarId;
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
}
