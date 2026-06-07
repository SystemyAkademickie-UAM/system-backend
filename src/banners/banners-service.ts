import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BannerEntity } from '../database/entities/banner.entity';

@Injectable()
export class BannersService {
  constructor(
    @InjectRepository(BannerEntity)
    private readonly bannersRepository: Repository<BannerEntity>,
  ) {}

  /**
   * Retrieves all predefined banners from the database, ordered by ID ascending.
   */
  async getBanners(): Promise<BannerEntity[]> {
    return this.bannersRepository.find({
      order: { id: 'ASC' },
    });
  }
}
