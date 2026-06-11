import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { Repository } from 'typeorm';

import {
  computeCertificateFingerprintSha256,
  normalizePemCertificate,
  parseCertificateValidity,
} from '../../auth/saml/x509-cert.util';
import { fetchIdpMetadata } from '../../auth/saml/idp-metadata.util';
import { AdminAccessService } from '../admin-access.service';
import { IdpCertificateEntity } from '../../database/entities/idp-certificate.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  UploadOrganizationCertificateDto,
} from './dto/admin-organization.dto';

export type OrganizationListItem = {
  id: number;
  name: string;
  isActive: boolean;
  ssoLoginUrl: string | null;
  certificateFingerprint: string | null;
  certificateValidUntil: string | null;
};

export type OrganizationDetail = OrganizationListItem & {
  contactEmail: string | null;
  contactPhone: string | null;
  entityId: string | null;
  metadataUrl: string | null;
  ssoLogoutUrl: string | null;
  certificateId: number | null;
};

@Injectable()
export class AdminOrganizationsService {
  private readonly logger = new Logger(AdminOrganizationsService.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(IdpCertificateEntity)
    private readonly certificateRepository: Repository<IdpCertificateEntity>,
  ) {}

  async listOrganizations(req: Request, queryAuth?: string): Promise<OrganizationListItem[]> {
    await this.assertSuperAdmin(req, queryAuth);
    const rows = await this.organizationRepository.find({ order: { id: 'ASC' } });
    const items: OrganizationListItem[] = [];
    for (const row of rows) {
      items.push(await this.toListItem(row));
    }
    return items;
  }

  async getOrganization(req: Request, organizationId: number, queryAuth?: string): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, queryAuth);
    const row = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (row === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    return this.toDetail(row);
  }

  async createOrganization(req: Request, dto: CreateOrganizationDto): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, dto.auth);
    const entity = this.organizationRepository.create({
      name: dto.name.trim(),
      contactEmail: dto.contactEmail?.trim() ?? null,
      contactPhone: dto.contactPhone?.trim() ?? null,
      entityId: dto.entityId?.trim() ?? null,
      metadataUrl: dto.metadataUrl?.trim() ?? null,
      ssoLoginUrl: dto.ssoLoginUrl?.trim() ?? null,
      ssoLogoutUrl: dto.ssoLogoutUrl?.trim() ?? null,
      isActive: true,
    });
    const saved = await this.organizationRepository.save(entity);
    const metadataUrl = saved.metadataUrl?.trim() ?? '';
    if (metadataUrl !== '') {
      await this.applyMetadataFromUrl(saved.id, metadataUrl);
    } else if (dto.certificatePem !== undefined && dto.certificatePem.trim() !== '') {
      await this.addCertificateInternal(saved.id, dto.certificatePem);
    }
    this.logger.log(`Organization created id=${saved.id} name="${saved.name}"`);
    const refreshed = await this.organizationRepository.findOneOrFail({ where: { id: saved.id } });
    return this.toDetail(refreshed);
  }

  async updateOrganization(
    req: Request,
    organizationId: number,
    dto: UpdateOrganizationDto,
  ): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, dto.auth);
    const row = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (row === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.contactEmail !== undefined) {
      row.contactEmail = dto.contactEmail?.trim() ?? null;
    }
    if (dto.contactPhone !== undefined) {
      row.contactPhone = dto.contactPhone?.trim() ?? null;
    }
    if (dto.entityId !== undefined) {
      row.entityId = dto.entityId?.trim() ?? null;
    }
    if (dto.metadataUrl !== undefined) {
      row.metadataUrl = dto.metadataUrl?.trim() ?? null;
    }
    if (dto.ssoLoginUrl !== undefined) {
      row.ssoLoginUrl = dto.ssoLoginUrl?.trim() ?? null;
    }
    if (dto.ssoLogoutUrl !== undefined) {
      row.ssoLogoutUrl = dto.ssoLogoutUrl?.trim() ?? null;
    }
    if (dto.isActive !== undefined) {
      row.isActive = dto.isActive;
    }
    await this.organizationRepository.save(row);
    if (dto.metadataUrl !== undefined) {
      const metadataUrl = row.metadataUrl?.trim() ?? '';
      if (metadataUrl !== '') {
        await this.applyMetadataFromUrl(organizationId, metadataUrl);
      }
    }
    this.logger.log(`Organization updated id=${organizationId}`);
    const refreshed = await this.organizationRepository.findOneOrFail({ where: { id: organizationId } });
    return this.toDetail(refreshed);
  }

  async softDeleteOrganization(req: Request, organizationId: number, queryAuth?: string): Promise<void> {
    await this.assertSuperAdmin(req, queryAuth);
    const row = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (row === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    row.isActive = false;
    await this.organizationRepository.save(row);
    this.logger.log(`Organization soft-deleted id=${organizationId}`);
  }

  async syncFromMetadata(
    req: Request,
    organizationId: number,
    queryAuth?: string,
  ): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, queryAuth);
    const row = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (row === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    const metadataUrl = row.metadataUrl?.trim() ?? '';
    if (metadataUrl === '') {
      throw new NotFoundException(`Organization ${organizationId} has no metadata_url`);
    }
    await this.applyMetadataFromUrl(organizationId, metadataUrl);
    const refreshed = await this.organizationRepository.findOneOrFail({ where: { id: organizationId } });
    return this.toDetail(refreshed);
  }

  async addCertificate(
    req: Request,
    organizationId: number,
    dto: UploadOrganizationCertificateDto,
  ): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, dto.auth);
    await this.addCertificateInternal(organizationId, dto.certificatePem);
    const row = await this.organizationRepository.findOneOrFail({ where: { id: organizationId } });
    return this.toDetail(row);
  }

  async revokeCertificate(
    req: Request,
    organizationId: number,
    certificateId: number,
    queryAuth?: string,
  ): Promise<void> {
    await this.assertSuperAdmin(req, queryAuth);
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId, organizationId },
    });
    if (certificate === null) {
      throw new NotFoundException(`Certificate ${certificateId} not found for organization ${organizationId}`);
    }
    certificate.isActive = false;
    await this.certificateRepository.save(certificate);
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization !== null && organization.certificateId === certificateId) {
      organization.certificateId = null;
      await this.organizationRepository.save(organization);
    }
    this.logger.log(`Certificate revoked id=${certificateId} org=${organizationId}`);
  }

  private async applyMetadataFromUrl(organizationId: number, metadataUrl: string): Promise<void> {
    let parsed;
    try {
      parsed = await fetchIdpMetadata(metadataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown metadata fetch error';
      throw new BadRequestException(`IdP metadata fetch failed: ${message}`);
    }
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    organization.entityId = parsed.entityId;
    organization.ssoLoginUrl = parsed.ssoLoginUrl;
    organization.ssoLogoutUrl = parsed.ssoLogoutUrl;
    organization.metadataUrl = metadataUrl;
    await this.organizationRepository.save(organization);
    await this.addCertificateInternal(organizationId, parsed.signingCertificatePem);
    this.logger.log(`Synced IdP metadata for org=${organizationId} from ${metadataUrl}`);
  }

  private async addCertificateInternal(organizationId: number, certificatePem: string): Promise<void> {
    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (organization === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    const pem = normalizePemCertificate(certificatePem);
    const fingerprint = computeCertificateFingerprintSha256(pem);
    const validity = parseCertificateValidity(pem);
    if (organization.certificateId !== null) {
      await this.certificateRepository.update({ id: organization.certificateId }, { isActive: false });
    }
    const cert = this.certificateRepository.create({
      organizationId,
      certificate: pem,
      fingerprint,
      validFrom: validity.validFrom,
      validUntil: validity.validUntil,
      isActive: true,
    });
    const saved = await this.certificateRepository.save(cert);
    organization.certificateId = saved.id;
    await this.organizationRepository.save(organization);
    this.logger.log(`Certificate rotated org=${organizationId} certId=${saved.id} fingerprint=${fingerprint}`);
  }

  private async toListItem(row: OrganizationEntity): Promise<OrganizationListItem> {
    const cert = row.certificateId !== null
      ? await this.certificateRepository.findOne({ where: { id: row.certificateId } })
      : null;
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      ssoLoginUrl: row.ssoLoginUrl,
      certificateFingerprint: cert?.fingerprint ?? null,
      certificateValidUntil: cert?.validUntil?.toISOString() ?? null,
    };
  }

  private async toDetail(row: OrganizationEntity): Promise<OrganizationDetail> {
    const listItem = await this.toListItem(row);
    return {
      ...listItem,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      entityId: row.entityId,
      metadataUrl: row.metadataUrl,
      ssoLogoutUrl: row.ssoLogoutUrl,
      certificateId: row.certificateId,
    };
  }

  private async assertSuperAdmin(req: Request, queryAuth?: string): Promise<void> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
  }
}
