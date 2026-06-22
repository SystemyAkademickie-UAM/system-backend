import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';



import { verifyCertificateFingerprint } from './x509-cert.util';

import { IdpCertificateEntity } from '../../database/entities/idp-certificate.entity';

import { OrganizationEntity } from '../../database/entities/organization.entity';



export type OrganizationSamlConfig = {

  organizationId: number;

  organizationName: string;

  entityId: string;

  entryPoint: string;

  logoutUrl?: string;

  idpCert: string;

  certificateId: number;

};



/**

 * Loads per-organization IdP SAML settings from the database.

 */

@Injectable()

export class SamlOrganizationConfigService {

  constructor(

    @InjectRepository(OrganizationEntity)

    private readonly organizationRepository: Repository<OrganizationEntity>,

    @InjectRepository(IdpCertificateEntity)

    private readonly certificateRepository: Repository<IdpCertificateEntity>) {}



  async loadOrganizationSamlConfig(organizationId: number): Promise<OrganizationSamlConfig> {

    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });

    if (organization === null || !organization.isActive) {

      throw new NotFoundException({

        error: 'SAML_ORGANIZATION_NOT_FOUND',

        message: `Organization ${organizationId} was not found or is inactive.`,

      });

    }

    if (

      organization.ssoLoginUrl === null ||

      organization.ssoLoginUrl.trim() === '' ||

      organization.certificateId === null

    ) {

      throw new ServiceUnavailableException({

        error: 'SAML_ORGANIZATION_NOT_CONFIGURED',

        message: `Organization "${organization.name}" has no SAML IdP configuration.`,

      });

    }

    const certificate = await this.certificateRepository.findOne({

      where: { id: organization.certificateId, organizationId, isActive: true },

    });

    if (certificate === null) {

      throw new ServiceUnavailableException({

        error: 'SAML_ORGANIZATION_CERT_MISSING',

        message: `Organization "${organization.name}" has no active IdP certificate.`,

      });

    }

    if (!verifyCertificateFingerprint(certificate.certificate, certificate.fingerprint)) {

      throw new ServiceUnavailableException({

        error: 'SAML_ORGANIZATION_CERT_INTEGRITY',

        message: `IdP certificate fingerprint mismatch for organization "${organization.name}".`,

      });

    }

    return {

      organizationId: organization.id,

      organizationName: organization.name,

      entityId: organization.entityId ?? organization.ssoLoginUrl,

      entryPoint: organization.ssoLoginUrl,

      logoutUrl: organization.ssoLogoutUrl ?? undefined,

      idpCert: certificate.certificate,

      certificateId: certificate.id,

    };

  }

}

