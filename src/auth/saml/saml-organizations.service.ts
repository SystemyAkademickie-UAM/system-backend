import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../../database/entities/organization.entity';

export type SamlOrganizationListItem = {
  id: number;
  name: string;
};

/**
 * Read-only access to SAML-ready organizations for the institution picker.
 */
@Injectable()
export class SamlOrganizationsService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
  ) {}

  async listOrganizations(): Promise<SamlOrganizationListItem[]> {
    const rows = await this.organizationRepository
      .createQueryBuilder('org')
      .select(['org.id', 'org.name'])
      .where('org.is_active = true')
      .andWhere('org.sso_login_url IS NOT NULL')
      .andWhere("TRIM(org.sso_login_url) <> ''")
      .andWhere('org.certificate_id IS NOT NULL')
      .orderBy('org.id', 'ASC')
      .getMany();
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  async assertOrganizationExists(organizationId: number): Promise<void> {
    const exists = await this.organizationRepository.exist({
      where: { id: organizationId, isActive: true },
    });
    if (!exists) {
      throw new NotFoundException({
        error: 'SAML_ORGANIZATION_NOT_FOUND',
        message: `Organization ${organizationId} was not found.`,
      });
    }
  }
}