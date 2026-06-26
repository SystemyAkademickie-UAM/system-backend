import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
  PRIVATE_ORGANIZATION_ID,
} from '../../constants/organization-constants';
import { OrganizationEntity } from '../../database/entities/organization.entity';

export type OrganizationLoginListItem = {
  id: number;
  name: string;
  loginMethod: string;
};

/** Public institution picker login methods (excludes internal org 1). */
export type PublicOrganizationLoginMethod =
  | typeof ORGANIZATION_LOGIN_METHOD_SAML
  | typeof ORGANIZATION_LOGIN_METHOD_EMAIL;

/**
 * Reads auth.organizations for login pickers and login-method checks.
 * One row per tenant; organization id + login_method uniquely identifies how to sign in.
 */
@Injectable()
export class OrganizationLoginService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
  ) {}

  async listOrganizations(loginMethod: PublicOrganizationLoginMethod): Promise<OrganizationLoginListItem[]> {
    if (loginMethod === ORGANIZATION_LOGIN_METHOD_SAML) {
      return this.listSamlOrganizations();
    }
    return this.listEmailOrganizations();
  }

  async assertOrganizationLoginMethod(
    organizationId: number,
    loginMethod: PublicOrganizationLoginMethod,
  ): Promise<OrganizationEntity> {
    if (loginMethod === ORGANIZATION_LOGIN_METHOD_SAML) {
      return this.assertSamlOrganization(organizationId);
    }
    return this.assertEmailOrganization(organizationId);
  }

  private async listSamlOrganizations(): Promise<OrganizationLoginListItem[]> {
    const rows = await this.organizationRepository
      .createQueryBuilder('org')
      .select(['org.id', 'org.name', 'org.loginMethod'])
      .where('org.is_active = true')
      .andWhere('org.id <> :privateOrgId', { privateOrgId: PRIVATE_ORGANIZATION_ID })
      .andWhere('org.login_method = :loginMethod', { loginMethod: ORGANIZATION_LOGIN_METHOD_SAML })
      .andWhere('org.sso_login_url IS NOT NULL')
      .andWhere("TRIM(org.sso_login_url) <> ''")
      .andWhere('org.certificate_id IS NOT NULL')
      .orderBy('org.id', 'ASC')
      .getMany();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      loginMethod: row.loginMethod,
    }));
  }

  private async listEmailOrganizations(): Promise<OrganizationLoginListItem[]> {
    const rows = await this.organizationRepository
      .createQueryBuilder('org')
      .select(['org.id', 'org.name', 'org.loginMethod'])
      .where('org.is_active = true')
      .andWhere('org.id <> :privateOrgId', { privateOrgId: PRIVATE_ORGANIZATION_ID })
      .orderBy('org.id', 'ASC')
      .getMany();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      loginMethod: row.loginMethod,
    }));
  }

  private async assertSamlOrganization(organizationId: number): Promise<OrganizationEntity> {
    const row = await this.organizationRepository.findOne({
      where: {
        id: organizationId,
        isActive: true,
        loginMethod: ORGANIZATION_LOGIN_METHOD_SAML,
      },
    });
    if (row === null || organizationId === PRIVATE_ORGANIZATION_ID) {
      throw new NotFoundException({
        error: 'SAML_ORGANIZATION_NOT_FOUND',
        message: `Organization ${organizationId} was not found or does not use SAML login.`,
      });
    }
    if (row.ssoLoginUrl === null || row.ssoLoginUrl.trim() === '' || row.certificateId === null) {
      throw new NotFoundException({
        error: 'SAML_ORGANIZATION_NOT_FOUND',
        message: `Organization ${organizationId} is not SAML-ready.`,
      });
    }
    return row;
  }

  private async assertEmailOrganization(organizationId: number): Promise<OrganizationEntity> {
    const row = await this.organizationRepository.findOne({
      where: {
        id: organizationId,
        isActive: true,
        loginMethod: ORGANIZATION_LOGIN_METHOD_EMAIL,
      },
    });
    if (row === null || organizationId === PRIVATE_ORGANIZATION_ID) {
      throw new NotFoundException({
        error: 'EMAIL_ORGANIZATION_NOT_FOUND',
        message: `Organization ${organizationId} was not found or does not use email login.`,
      });
    }
    return row;
  }
}
