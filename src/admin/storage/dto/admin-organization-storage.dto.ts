import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StorageFileItemDto {
  @ApiProperty({ description: 'Drive UUID reference of the stored banner/file' })
  ref: string;

  @ApiProperty({ description: 'File name on disk' })
  fileName: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'Detected MIME type (e.g. image/png, image/jpeg)' })
  mimeType: string;

  @ApiProperty({ description: 'Date and time when the file was created/uploaded' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Associated group ID if assigned as a group banner', nullable: true })
  groupId: number | null;

  @ApiPropertyOptional({ description: 'Associated group name if assigned as a group banner', nullable: true })
  groupName: string | null;

  @ApiPropertyOptional({ description: 'Associated academic subject name', nullable: true })
  subjectName: string | null;

  @ApiPropertyOptional({ description: 'Teacher/Lecturer full name who owns the group', nullable: true })
  lecturerName: string | null;

  @ApiPropertyOptional({ description: 'Teacher/Lecturer email who owns the group', nullable: true })
  lecturerEmail: string | null;

  @ApiProperty({ description: 'Relative URL to fetch or preview the image' })
  downloadUrl: string;
}

export class OrganizationStorageDetailDto {
  @ApiProperty({ description: 'Organization tenant ID' })
  organizationId: number;

  @ApiProperty({ description: 'Organization name' })
  organizationName: string;

  @ApiProperty({ description: 'Relative storage directory assigned to this organization' })
  folderPath: string;

  @ApiProperty({ description: 'Storage quota allocated to this organization in bytes' })
  quotaBytes: number;

  @ApiProperty({ description: 'Currently used disk space in bytes' })
  usedBytes: number;

  @ApiProperty({ description: 'Remaining available disk space in bytes' })
  availableBytes: number;

  @ApiProperty({ description: 'Disk space usage percentage (0-100)' })
  usagePercent: number;

  @ApiProperty({ description: 'Number of stored files/banners in this organization' })
  fileCount: number;

  @ApiProperty({ description: 'Total host server storage pool across all organizations in bytes' })
  serverTotalPoolBytes: number;

  @ApiProperty({ description: 'Maximum allowed single file size in bytes' })
  maxFileSizeBytes: number;

  @ApiProperty({ description: 'Estimated capacity of banner files within the quota' })
  estimatedMaxBanners: number;

  @ApiProperty({ description: 'List of files/banners stored for this organization', type: [StorageFileItemDto] })
  files: StorageFileItemDto[];
}

export class OrganizationDashboardSummaryAccountsDto {
  @ApiProperty({ description: 'Total number of accounts in the organization' })
  total: number;

  @ApiProperty({ description: 'Number of student accounts (osoba studiująca)' })
  students: number;

  @ApiProperty({ description: 'Number of lecturer accounts (osoba prowadząca)' })
  lecturers: number;

  @ApiProperty({ description: 'Number of administrator accounts (osoba administrująca)' })
  administrators: number;
}

export class OrganizationDashboardSummaryGroupsDto {
  @ApiProperty({ description: 'Total number of groups created by lecturers in this organization' })
  total: number;

  @ApiProperty({ description: 'Number of groups with an uploaded custom banner' })
  withBanner: number;
}

export class OrganizationDashboardSummaryStorageDto {
  @ApiProperty({ description: 'Assigned directory path on disk' })
  folderPath: string;

  @ApiProperty({ description: 'Quota in bytes' })
  quotaBytes: number;

  @ApiProperty({ description: 'Used bytes' })
  usedBytes: number;

  @ApiProperty({ description: 'Available bytes' })
  availableBytes: number;

  @ApiProperty({ description: 'Usage percentage (0-100)' })
  usagePercent: number;

  @ApiProperty({ description: 'Total files stored' })
  fileCount: number;

  @ApiProperty({ description: 'Number of group banners' })
  bannersCount: number;

  @ApiProperty({ description: 'Total server host pool in bytes' })
  serverTotalPoolBytes: number;

  @ApiProperty({ description: 'Max allowed size per banner in bytes' })
  maxFileSizeBytes: number;

  @ApiProperty({ description: 'Estimated banner capacity' })
  estimatedMaxBanners: number;
}

export class OrganizationDashboardRecentActivityDto {
  @ApiProperty({ description: 'Log entry ID' })
  id: number;

  @ApiProperty({ description: 'Event timestamp' })
  occurredAt: string;

  @ApiProperty({ description: 'Log category (organization | group)' })
  category: string;

  @ApiProperty({ description: 'Event kind (e.g. file_stored, account_created)' })
  kind: string;

  @ApiProperty({ description: 'Actor user display name' })
  actorName: string;

  @ApiPropertyOptional({ description: 'Affected account display name' })
  subjectName?: string;

  @ApiPropertyOptional({ description: 'Associated group name' })
  groupName?: string;

  @ApiPropertyOptional({ description: 'Associated file name' })
  fileName?: string;

  @ApiPropertyOptional({ description: 'File size in bytes if applicable' })
  fileSizeBytes?: number;
}

export class OrganizationDashboardDetailDto {
  @ApiProperty({ description: 'Organization metadata' })
  organization: {
    id: number;
    name: string;
    domain: string | null;
    loginMethod: string;
    contactEmail: string | null;
    contactPhone: string | null;
    representative: {
      fullName: string | null;
      email: string | null;
      phone: string | null;
    };
    address: {
      town: string | null;
      street: string | null;
      building: string | null;
      postalCode: string | null;
      country: string | null;
    };
    isActive: boolean;
    createdAt: string;
  };

  @ApiProperty({ description: 'Summary metrics across accounts, groups, and storage' })
  summary: {
    accounts: OrganizationDashboardSummaryAccountsDto;
    groups: OrganizationDashboardSummaryGroupsDto;
    storage: OrganizationDashboardSummaryStorageDto;
    recentActivity: OrganizationDashboardRecentActivityDto[];
  };
}
