export type AutoBackupScheduleInterval =
  | 'daily'
  | 'every_3_days'
  | 'weekly'
  | 'every_2_weeks'
  | 'custom';

export interface AutoBackupScheduleConfig {
  enabled: boolean;
  interval: AutoBackupScheduleInterval;
  customIntervalDays?: number | null;
  timeOfDay: string;
  nextRunAt?: string | null;
}

export interface BackupFileSummary {
  filename: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupStatusResponse {
  lastBackupAt: string | null;
  lastManualBackupAt: string | null;
  lastAutoBackupAt: string | null;
  isManualBackupOverdue: boolean;
  daysSinceLastManualBackup: number | null;
  manualBackupThresholdDays: number;
  retentionDays: number;
  autoBackupsCount: number;
  totalStorageSizeBytes: number;
  autoBackups: BackupFileSummary[];
  schedule: AutoBackupScheduleConfig;
}

export interface BackupMetadata {
  lastAutoBackupAt: string | null;
  lastAutoBackupFilename: string | null;
  lastManualBackupAt: string | null;
  lastRestoreAt: string | null;
  schedule?: AutoBackupScheduleConfig;
}
