import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';

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
  ORGANIZATION_DOMAIN_INVALID_MESSAGE,
  ORGANIZATION_DOMAIN_PATTERN,
  ORGANIZATION_LOGIN_METHOD_EMAIL,
  ORGANIZATION_LOGIN_METHOD_SAML,
} from '../../constants/organization-constants';
import {
  BulkOrganizationsDto,
  CreateOrganizationDto,
  UpdateOrganizationAddressDto,
  UpdateOrganizationDto,
  UpdateOrganizationRepresentativeDto,
  UploadOrganizationCertificateDto,
} from './dto/admin-organization.dto';

export type OrganizationListItem = {
  id: number;
  name: string;
  isActive: boolean;
  domain: string | null;
};

export type OrganizationRepresentative = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
};

export type OrganizationAddress = {
  town: string | null;
  street: string | null;
  building: string | null;
  postalCode: string | null;
  country: string | null;
};

export type OrganizationDetail = OrganizationListItem & {
  loginMethod: string;
  ssoLoginUrl: string | null;
  certificateFingerprint: string | null;
  certificateValidUntil: string | null;
  representative: OrganizationRepresentative;
  address: OrganizationAddress;
  contactEmail: string | null;
  contactPhone: string | null;
  entityId: string | null;
  metadataUrl: string | null;
  ssoLogoutUrl: string | null;
  certificateId: number | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AdminOrganizationsService {
  private readonly logger = new Logger(AdminOrganizationsService.name);

  constructor(
    private readonly adminAccessService: AdminAccessService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(IdpCertificateEntity)
    private readonly certificateRepository: Repository<IdpCertificateEntity>) {}

  async listOrganizations(req: Request, queryAuth?: string): Promise<OrganizationListItem[]> {
    await this.assertSuperAdmin(req, queryAuth);
    const rows = await this.organizationRepository.find({ order: { id: 'ASC' } });
    const items: OrganizationListItem[] = [];
    for (const row of rows) {
      items.push(this.toListItem(row));
    }
    return items;
  }

  async bulkOrganizations(
    req: Request,
    dto: BulkOrganizationsDto,
  ): Promise<{ organizations: OrganizationDetail[] }> {
    await this.assertSuperAdmin(req, dto.auth);
    const ids: number[] = [];
    for (const id of dto.ids) {
      if (!ids.includes(id)) {
        ids.push(id);
      }
    }
    const rows = await this.organizationRepository.find({ where: { id: In(ids) } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const missingIds = ids.filter((id) => !byId.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Organizations not found',
        error: 'Not Found',
        missingIds,
      });
    }
    const organizations: OrganizationDetail[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row === undefined) {
        throw new NotFoundException(`Organization ${id} not found`);
      }
      organizations.push(await this.toDetail(row));
    }
    return { organizations };
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
    this.assertFunctionalCreateData(dto);
    const loginMethod = dto.loginMethod;
    const domain = this.normalizeDomain(dto.domain);
    await this.assertDomainAvailable(domain);
    const representativePhone = this.blankToNull(dto.representative.phone);
    const entity = this.organizationRepository.create({
      name: dto.name.trim(),
      loginMethod,
      domain,
      representativeFullName: dto.representative.fullName.trim(),
      representativeEmail: dto.representative.email.trim(),
      representativePhone,
      addressTown: dto.address.town.trim(),
      addressStreet: dto.address.street.trim(),
      addressBuilding: this.blankToNull(dto.address.building),
      addressPostalCode: this.blankToNull(dto.address.postalCode),
      addressCountry: this.normalizeCountry(dto.address.country),
      contactEmail: dto.representative.email.trim(),
      contactPhone: representativePhone,
      entityId: dto.entityId?.trim() ?? null,
      metadataUrl: dto.metadataUrl?.trim() ?? null,
      ssoLoginUrl: dto.ssoLoginUrl?.trim() ?? null,
      ssoLogoutUrl: dto.ssoLogoutUrl?.trim() ?? null,
      isActive: true,
    });
    const saved = await this.saveOrganization(entity, domain);
    const metadataUrl = saved.metadataUrl?.trim() ?? '';
    if (loginMethod !== ORGANIZATION_LOGIN_METHOD_EMAIL && metadataUrl !== '') {
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
    dto: UpdateOrganizationDto): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, dto.auth);
    const row = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (row === null) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (dto.name !== undefined) {
      row.name = dto.name.trim();
    }
    if (dto.domain !== undefined) {
      const domain = this.normalizeDomain(dto.domain);
      await this.assertDomainAvailable(domain, organizationId);
      row.domain = domain;
    }
    if (dto.representative !== undefined) {
      this.applyRepresentativePatch(row, dto.representative);
    }
    if (dto.address !== undefined) {
      this.applyAddressPatch(row, dto.address);
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
    await this.saveOrganization(row, row.domain);
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
    queryAuth?: string): Promise<OrganizationDetail> {
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
    dto: UploadOrganizationCertificateDto): Promise<OrganizationDetail> {
    await this.assertSuperAdmin(req, dto.auth);
    await this.addCertificateInternal(organizationId, dto.certificatePem);
    const row = await this.organizationRepository.findOneOrFail({ where: { id: organizationId } });
    return this.toDetail(row);
  }

  async revokeCertificate(
    req: Request,
    organizationId: number,
    certificateId: number,
    queryAuth?: string): Promise<void> {
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
    organization.loginMethod = ORGANIZATION_LOGIN_METHOD_SAML;
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

  private toListItem(row: OrganizationEntity): OrganizationListItem {
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      domain: row.domain,
    };
  }

  private async toDetail(row: OrganizationEntity): Promise<OrganizationDetail> {
    const cert = row.certificateId !== null
      ? await this.certificateRepository.findOne({ where: { id: row.certificateId } })
      : null;
    const listItem = this.toListItem(row);
    return {
      ...listItem,
      loginMethod: row.loginMethod,
      ssoLoginUrl: row.ssoLoginUrl,
      certificateFingerprint: cert?.fingerprint ?? null,
      certificateValidUntil: cert?.validUntil?.toISOString() ?? null,
      representative: {
        fullName: row.representativeFullName,
        email: row.representativeEmail,
        phone: row.representativePhone,
      },
      address: {
        town: row.addressTown,
        street: row.addressStreet,
        building: row.addressBuilding,
        postalCode: row.addressPostalCode,
        country: row.addressCountry,
      },
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      entityId: row.entityId,
      metadataUrl: row.metadataUrl,
      ssoLogoutUrl: row.ssoLogoutUrl,
      certificateId: row.certificateId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private assertFunctionalCreateData(dto: CreateOrganizationDto): void {
    if (dto.loginMethod === ORGANIZATION_LOGIN_METHOD_EMAIL) {
      return;
    }
    const metadataUrl = dto.metadataUrl?.trim() ?? '';
    if (metadataUrl !== '') {
      return;
    }
    const entityId = dto.entityId?.trim() ?? '';
    const ssoLoginUrl = dto.ssoLoginUrl?.trim() ?? '';
    const certificatePem = dto.certificatePem?.trim() ?? '';
    if (entityId !== '' && ssoLoginUrl !== '' && certificatePem !== '') {
      return;
    }
    throw new BadRequestException(
      'SAML organization requires metadataUrl, or entityId, ssoLoginUrl, and certificatePem',
    );
  }

  private normalizeDomain(raw: string): string {
    const domain = raw.trim().toLowerCase().replace(/\.$/, '');
    if (!ORGANIZATION_DOMAIN_PATTERN.test(domain)) {
      throw new BadRequestException(ORGANIZATION_DOMAIN_INVALID_MESSAGE);
    }
    return domain;
  }

  private blankToNull(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = value.trim();
    if (trimmed === '') {
      return null;
    }
    return trimmed;
  }

  private normalizeCountry(value: string | null | undefined): string | null {
    const country = this.blankToNull(value);
    if (country === null) {
      return null;
    }
    return country.toUpperCase();
  }

  private async assertDomainAvailable(domain: string, exceptOrganizationId?: number): Promise<void> {
    const existing = await this.organizationRepository.findOne({ where: { domain } });
    if (existing === null) {
      return;
    }
    if (exceptOrganizationId !== undefined && existing.id === exceptOrganizationId) {
      return;
    }
    throw new ConflictException(`Domain ${domain} is already used`);
  }

  private applyRepresentativePatch(row: OrganizationEntity, patch: UpdateOrganizationRepresentativeDto): void {
    if (patch.fullName !== undefined) {
      row.representativeFullName = patch.fullName.trim();
    }
    if (patch.email !== undefined) {
      const email = patch.email.trim();
      row.representativeEmail = email;
      row.contactEmail = email;
    }
    if (patch.phone !== undefined) {
      const phone = this.blankToNull(patch.phone);
      row.representativePhone = phone;
      row.contactPhone = phone;
    }
  }

  private applyAddressPatch(row: OrganizationEntity, patch: UpdateOrganizationAddressDto): void {
    if (patch.town !== undefined) {
      row.addressTown = patch.town.trim();
    }
    if (patch.street !== undefined) {
      row.addressStreet = patch.street.trim();
    }
    if (patch.building !== undefined) {
      row.addressBuilding = this.blankToNull(patch.building);
    }
    if (patch.postalCode !== undefined) {
      row.addressPostalCode = this.blankToNull(patch.postalCode);
    }
    if (patch.country !== undefined) {
      row.addressCountry = this.normalizeCountry(patch.country);
    }
  }

  private async saveOrganization(row: OrganizationEntity, domain: string | null): Promise<OrganizationEntity> {
    try {
      return await this.organizationRepository.save(row);
    } catch (error) {
      if (domain !== null && this.isUniqueViolation(error)) {
        throw new ConflictException(`Domain ${domain} is already used`);
      }
      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }
    if ('code' in error && error.code === '23505') {
      return true;
    }
    if ('driverError' in error && typeof error.driverError === 'object' && error.driverError !== null) {
      return 'code' in error.driverError && error.driverError.code === '23505';
    }
    return false;
  }

  private async assertSuperAdmin(req: Request, queryAuth?: string): Promise<void> {
    await this.adminAccessService.assertSuperAdmin(req, queryAuth);
  }
}
