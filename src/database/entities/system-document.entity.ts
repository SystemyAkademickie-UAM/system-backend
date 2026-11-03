import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import { SERVICES_SCHEMA } from '../../constants/database-schema-constants';
import {
  DOCUMENTS_FILENAME_MAX_LENGTH,
  DOCUMENTS_KEY_MAX_LENGTH,
  DOCUMENTS_STORAGE_KEY_MAX_LENGTH,
  DOCUMENTS_TITLE_MAX_LENGTH,
} from '../../constants/system-documents-constants';

/**
 * Managed application PDF document metadata (`services.system_documents`).
 */
@Entity({ schema: SERVICES_SCHEMA, name: 'system_documents' })
export class SystemDocumentEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'document_key',
    type: 'varchar',
    length: DOCUMENTS_KEY_MAX_LENGTH,
    unique: true,
  })
  documentKey: string;

  @Column({ type: 'varchar', length: DOCUMENTS_TITLE_MAX_LENGTH })
  title: string;

  @Column({ name: 'original_filename', type: 'varchar', length: DOCUMENTS_FILENAME_MAX_LENGTH })
  originalFilename: string;

  @Column({
    name: 'storage_key',
    type: 'varchar',
    length: DOCUMENTS_STORAGE_KEY_MAX_LENGTH,
  })
  storageKey: string;

  @Column({ name: 'file_size_bytes', type: 'integer' })
  fileSizeBytes: number;

  @Column({ name: 'uploaded_by_user_id', type: 'integer', nullable: true, default: null })
  uploadedByUserId: number | null;

  @Column({ name: 'uploaded_at', type: 'timestamp with time zone', default: () => 'NOW()' })
  uploadedAt: Date;
}

