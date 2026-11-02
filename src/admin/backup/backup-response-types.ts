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
}

export interface BackupMetadata {
  lastAutoBackupAt: string | null;
  lastAutoBackupFilename: string | null;
  lastManualBackupAt: string | null;
  lastRestoreAt: string | null;
}
