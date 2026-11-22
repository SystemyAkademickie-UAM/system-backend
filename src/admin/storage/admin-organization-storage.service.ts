import { existsSync } from 'node:fs';
import { copyFile, mkdir, open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Request } from 'express';
import { In, Repository } from 'typeorm';

import { AdminAccessService } from '../admin-access.service';
import {
  DRIVE_MAX_FILE_BYTES,
  DRIVE_MIME_SNIFF_BYTES,
  resolveDriveStorageRoot,
} from '../../constants/drive-service-constants';
import {
  ESTIMATED_BANNER_AVERAGE_BYTES,
  resolveOrganizationStorageQuotaBytes,
  resolveServerStoragePoolBytes,
} from '../../constants/organization-storage-constants';
import {
  ADMINISTRATOR_ROLE_NAME,
  LECTURER_ROLE_NAME,
  STUDENT_ROLE_NAME,
} from '../../constants/role-name-constants';
import { AccountEntity } from '../../database/entities/account.entity';
import { DriveEntity } from '../../database/entities/drive.entity';
import { GroupEntity } from '../../database/entities/group.entity';
import { OrganizationEntity } from '../../database/entities/organization.entity';
import { OrganizationLogEntity } from '../../database/entities/organization-log.entity';
import { UserEntity } from '../../database/entities/user.entity';
import {
  OrganizationDashboardDetailDto,
  OrganizationStorageDetailDto,
  StorageFileItemDto,
} from './dto/admin-organization-storage.dto';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function detectMimeTypeFromBuffer(buffer: Buffer): string {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (buffer.length >= 6 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'image/gif';
  }
  if (buffer.length >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

@Injectable()
export class AdminOrganizationStorageService {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    @InjectRepository(OrganizationEntity)
    private readonly organizationRepository: Repository<OrganizationEntity>,
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(GroupEntity)
    private readonly groupRepository: Repository<GroupEntity>,
    @InjectRepository(DriveEntity)
    private readonly driveRepository: Repository<DriveEntity>,
    @InjectRepository(OrganizationLogEntity)
    private readonly organizationLogRepository: Repository<OrganizationLogEntity>,
  ) {}

  /**
   * Returns dashboard metrics and summary for an organization.
   * Accessible by super administrators or administrators of the target organization.
   */
  async getOrganizationDashboard(
    req: Request,
    organizationId: number,
  ): Promise<OrganizationDashboardDetailDto> {
    await this.adminAccessService.resolveAccountDeletionActor(req, organizationId);
    const org = await this.assertOrganizationActive(organizationId);

    // 1. Account roster counts
    const accounts = await this.accountRepository.find({
      where: { organizationId },
    });

    let students = 0;
    let lecturers = 0;
    let administrators = 0;
    const lecturerAccountIds: number[] = [];

    for (const acc of accounts) {
      if (acc.role === STUDENT_ROLE_NAME) {
        students++;
      } else if (acc.role === LECTURER_ROLE_NAME) {
        lecturers++;
        lecturerAccountIds.push(acc.id);
      } else if (acc.role === ADMINISTRATOR_ROLE_NAME) {
        administrators++;
      }
    }

    // 2. Groups belonging to lecturers of this organization
    let totalGroups = 0;
    let groupsWithBanner = 0;
    if (lecturerAccountIds.length > 0) {
      const groups = await this.groupRepository.find({
        where: { teacherAccountId: In(lecturerAccountIds) },
        select: ['id', 'imageRef'],
      });
      totalGroups = groups.length;
      groupsWithBanner = groups.filter(
        (g) => typeof g.imageRef === 'string' && g.imageRef.trim().length > 0,
      ).length;
    }

    // 3. Storage metrics
    const storageFiles = await this.scanOrganizationFiles(organizationId);
    const quotaBytes = Number(org.storageQuotaBytes) || resolveOrganizationStorageQuotaBytes();
    const serverTotalPoolBytes = resolveServerStoragePoolBytes();
    let usedBytes = 0;
    for (const f of storageFiles) {
      usedBytes += f.size;
    }
    const availableBytes = Math.max(0, quotaBytes - usedBytes);
    const usagePercent = quotaBytes > 0
      ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10)
      : 0;
    const estimatedMaxBanners = Math.floor(quotaBytes / ESTIMATED_BANNER_AVERAGE_BYTES);

    // 4. Recent activity from organization log
    const recentLogs = await this.organizationLogRepository.find({
      where: { organizationId },
      order: { occurredAt: 'DESC', id: 'DESC' },
      take: 5,
    });

    const recentActivity = recentLogs.map((log) => ({
      id: log.id,
      occurredAt: log.occurredAt.toISOString(),
      category: log.category,
      kind: log.kind,
      actorName: log.actorName,
      subjectName: log.subjectName || undefined,
      groupName: log.groupName || undefined,
      fileName: log.fileName || undefined,
      fileSizeBytes: log.fileSizeBytes ?? undefined,
    }));

    return {
      organization: {
        id: org.id,
        name: org.name,
        domain: org.domain,
        loginMethod: org.loginMethod,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        representative: {
          fullName: org.representativeFullName,
          email: org.representativeEmail,
          phone: org.representativePhone,
        },
        address: {
          town: org.addressTown,
          street: org.addressStreet,
          building: org.addressBuilding,
          postalCode: org.addressPostalCode,
          country: org.addressCountry,
        },
        isActive: org.isActive,
        createdAt: org.createdAt.toISOString(),
      },
      summary: {
        accounts: {
          total: accounts.length,
          students,
          lecturers,
          administrators,
        },
        groups: {
          total: totalGroups,
          withBanner: groupsWithBanner,
        },
        storage: {
          folderPath: `storage/drive/${organizationId}`,
          quotaBytes,
          usedBytes,
          availableBytes,
          usagePercent,
          fileCount: storageFiles.length,
          bannersCount: groupsWithBanner,
          serverTotalPoolBytes,
          maxFileSizeBytes: DRIVE_MAX_FILE_BYTES,
          estimatedMaxBanners,
        },
        recentActivity,
      },
    };
  }

  /**
   * Returns storage quota, folder path, and file list for an organization.
   * Accessible by super administrators or administrators of the target organization.
   */
  async getOrganizationStorage(
    req: Request,
    organizationId: number,
  ): Promise<OrganizationStorageDetailDto> {
    await this.adminAccessService.resolveAccountDeletionActor(req, organizationId);
    const org = await this.assertOrganizationActive(organizationId);

    const rawFiles = await this.scanOrganizationFiles(organizationId);
    const quotaBytes = Number(org.storageQuotaBytes) || resolveOrganizationStorageQuotaBytes();
    const serverTotalPoolBytes = resolveServerStoragePoolBytes();

    // Map files to groups and teacher accounts
    const filesWithContext = await this.enrichFilesWithGroupContext(
      organizationId,
      rawFiles,
    );

    let usedBytes = 0;
    for (const f of rawFiles) {
      usedBytes += f.size;
    }
    const availableBytes = Math.max(0, quotaBytes - usedBytes);
    const usagePercent = quotaBytes > 0
      ? Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10)
      : 0;
    const estimatedMaxBanners = Math.floor(quotaBytes / ESTIMATED_BANNER_AVERAGE_BYTES);

    return {
      organizationId: org.id,
      organizationName: org.name,
      folderPath: `storage/drive/${organizationId}`,
      quotaBytes,
      usedBytes,
      availableBytes,
      usagePercent,
      fileCount: rawFiles.length,
      serverTotalPoolBytes,
      maxFileSizeBytes: DRIVE_MAX_FILE_BYTES,
      estimatedMaxBanners,
      files: filesWithContext,
    };
  }

  /**
   * Scans disk directory `<DRIVE_STORAGE_ROOT>/drive/<organizationId>`, finds lecturer group banners, and falls back / syncs with `services.drive`.
   */
  private async scanOrganizationFiles(
    organizationId: number,
  ): Promise<Array<{ ref: string; size: number; mimeType: string; createdAt: Date }>> {
    const driveRoot = join(resolveDriveStorageRoot(), 'drive');
    const orgFolder = join(driveRoot, String(organizationId));
    const diskFiles: Array<{ ref: string; size: number; mimeType: string; createdAt: Date }> = [];
    const scannedRefs = new Set<string>();

    // 1. Scan primary organization directory: storage/drive/<organizationId>
    if (existsSync(orgFolder)) {
      try {
        const entries = await readdir(orgFolder, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }
          const filename = entry.name.trim();
          if (!UUID_V4_REGEX.test(filename)) {
            continue;
          }
          const filePath = join(orgFolder, filename);
          try {
            const fileStat = await stat(filePath);
            const handle = await open(filePath, 'r');
            const header = Buffer.alloc(DRIVE_MIME_SNIFF_BYTES);
            await handle.read(header, 0, DRIVE_MIME_SNIFF_BYTES, 0);
            await handle.close();
            const mimeType = detectMimeTypeFromBuffer(header);
            diskFiles.push({
              ref: filename,
              size: fileStat.size,
              mimeType,
              createdAt: fileStat.birthtime ?? fileStat.mtime,
            });
            scannedRefs.add(filename);
          } catch {
            // Ignore unreadable or transient files
          }
        }
      } catch {
        // Ignore directory read failure
      }
    }

    // 2. Discover banners belonging to groups created by lecturers of this organization
    try {
      const teacherAccounts = await this.accountRepository.find({
        where: { organizationId, role: LECTURER_ROLE_NAME },
      });
      const teacherAccountIds = teacherAccounts.map((a) => a.id);
      if (teacherAccountIds.length > 0) {
        const groups = await this.groupRepository.find({
          where: { teacherAccountId: In(teacherAccountIds) },
          select: ['id', 'imageRef'],
        });

        for (const group of groups) {
          const bannerRef = group.imageRef?.trim();
          if (!bannerRef || !UUID_V4_REGEX.test(bannerRef) || scannedRefs.has(bannerRef)) {
            continue;
          }

          let foundPath: string | null = null;
          const directOrgPath = join(orgFolder, bannerRef);
          const defaultPath = join(driveRoot, '1', bannerRef);

          if (existsSync(directOrgPath)) {
            foundPath = directOrgPath;
          } else if (existsSync(defaultPath)) {
            foundPath = defaultPath;
          } else if (existsSync(driveRoot)) {
            try {
              const dirs = await readdir(driveRoot, { withFileTypes: true });
              for (const dir of dirs) {
                if (dir.isDirectory()) {
                  const candidate = join(driveRoot, dir.name, bannerRef);
                  if (existsSync(candidate)) {
                    foundPath = candidate;
                    break;
                  }
                }
              }
            } catch {
              // Ignore traversal errors
            }
          }

          if (foundPath) {
            try {
              const fileStat = await stat(foundPath);
              const handle = await open(foundPath, 'r');
              const header = Buffer.alloc(DRIVE_MIME_SNIFF_BYTES);
              await handle.read(header, 0, DRIVE_MIME_SNIFF_BYTES, 0);
              await handle.close();
              const mimeType = detectMimeTypeFromBuffer(header);

              if (foundPath !== directOrgPath) {
                try {
                  await mkdir(orgFolder, { recursive: true });
                  await copyFile(foundPath, directOrgPath);
                } catch {
                  // Non-critical copy error
                }
              }

              diskFiles.push({
                ref: bannerRef,
                size: fileStat.size,
                mimeType,
                createdAt: fileStat.birthtime ?? fileStat.mtime,
              });
              scannedRefs.add(bannerRef);
            } catch {
              // Ignore unreadable file
            }
          }
        }
      }
    } catch {
      // Ignore group query failure
    }

    // 3. Also check database `services.drive` for any records not already scanned on disk
    try {
      const dbRecords = await this.driveRepository.find({
        where: { organizationId },
      });
      for (const rec of dbRecords) {
        if (!scannedRefs.has(rec.ref)) {
          diskFiles.push({
            ref: rec.ref,
            size: rec.size,
            mimeType: rec.mimeType,
            createdAt: rec.createdAt,
          });
          scannedRefs.add(rec.ref);
        }
      }
    } catch {
      // Ignore DB errors if drive table is not populated
    }

    // Sort by creation date descending
    diskFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return diskFiles;
  }

  private async enrichFilesWithGroupContext(
    organizationId: number,
    files: Array<{ ref: string; size: number; mimeType: string; createdAt: Date }>,
  ): Promise<StorageFileItemDto[]> {
    if (files.length === 0) {
      return [];
    }

    // 1. Find all teacher accounts in this organization
    const teacherAccounts = await this.accountRepository.find({
      where: { organizationId, role: LECTURER_ROLE_NAME },
    });
    const teacherAccountIds = teacherAccounts.map((a) => a.id);

    // 2. Map teacher accounts to user names and emails
    const teacherUserIds = [...new Set(teacherAccounts.map((a) => a.userId))];
    const users = teacherUserIds.length > 0
      ? await this.userRepository.find({ where: { id: In(teacherUserIds) } })
      : [];
    const usersById = new Map(users.map((u) => [u.id, u]));
    const teacherInfoByAccountId = new Map<number, { name: string; email: string }>();
    for (const acc of teacherAccounts) {
      const user = usersById.get(acc.userId);
      if (user) {
        const fullName = `${user.name} ${user.surname}`.trim();
        teacherInfoByAccountId.set(acc.id, {
          name: fullName || user.nickname || user.email,
          email: user.email,
        });
      }
    }

    // 3. Find groups with banners in this organization
    const fileRefs = files.map((f) => f.ref);
    const groups = teacherAccountIds.length > 0
      ? await this.groupRepository.find({
          where: {
            teacherAccountId: In(teacherAccountIds),
            imageRef: In(fileRefs),
          },
        })
      : [];

    const groupByImageRef = new Map<string, GroupEntity>();
    for (const g of groups) {
      if (g.imageRef) {
        groupByImageRef.set(g.imageRef.trim(), g);
      }
    }

    return files.map((file) => {
      const group = groupByImageRef.get(file.ref);
      let lecturerName: string | null = null;
      let lecturerEmail: string | null = null;
      if (group) {
        const teacher = teacherInfoByAccountId.get(group.teacherAccountId);
        if (teacher) {
          lecturerName = teacher.name;
          lecturerEmail = teacher.email;
        }
      }

      return {
        ref: file.ref,
        fileName: file.ref,
        size: file.size,
        mimeType: file.mimeType,
        createdAt: file.createdAt.toISOString(),
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
        subjectName: group?.subjectName ?? null,
        lecturerName,
        lecturerEmail,
        downloadUrl: `/api/drive/${file.ref}?organizationId=${organizationId}`,
      };
    });
  }

  private async assertOrganizationActive(organizationId: number): Promise<OrganizationEntity> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization ${organizationId} not found`);
    }
    if (!org.isActive) {
      throw new BadRequestException(`Organization ${organizationId} is inactive`);
    }
    return org;
  }
}
