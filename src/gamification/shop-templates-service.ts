import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DefaultItemTemplateEntity } from '../database/entities/default-item-template.entity';

@Injectable()
export class ShopTemplatesService {
  constructor(
    @InjectRepository(DefaultItemTemplateEntity)
    private readonly templateRepository: Repository<DefaultItemTemplateEntity>) {}

  async getDefaultTemplates(): Promise<DefaultItemTemplateEntity[]> {
    return this.templateRepository.find({
      order: { basePrice: 'DESC', name: 'ASC' },
    });
  }
}
