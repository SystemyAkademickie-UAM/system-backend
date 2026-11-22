import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';
import {
  PATCH_NOTES_FILENAME_MAX_LENGTH,
  PATCH_NOTES_STORAGE_KEY_MAX_LENGTH,
  PATCH_NOTES_TITLE_MAX_LENGTH,
  PATCH_NOTES_VERSION_MAX_LENGTH,
} from '../../constants/patch-notes-constants';

/**
 * Patch note PDF document metadata (`services.patch_notes`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'patch_notes' })
export class PatchNoteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: PATCH_NOTES_TITLE_MAX_LENGTH })
  title: string;

  @Column({ type: 'varchar', length: PATCH_NOTES_VERSION_MAX_LENGTH, nullable: true, default: null })
  version: string | null;

  @Column({ name: 'original_filename', type: 'varchar', length: PATCH_NOTES_FILENAME_MAX_LENGTH })
  originalFilename: string;

  @Column({
    name: 'storage_key',
    type: 'varchar',
    length: PATCH_NOTES_STORAGE_KEY_MAX_LENGTH,
    unique: true,
  })
  storageKey: string;

  @Column({ name: 'file_size_bytes', type: 'integer' })
  fileSizeBytes: number;

  @Column({ name: 'uploaded_by_user_id', type: 'integer', nullable: true, default: null })
  uploadedByUserId: number | null;

  @Column({ name: 'created_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  createdAt: Date;
}

