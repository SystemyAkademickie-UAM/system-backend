import type { SystemDocumentKey } from '../constants/system-documents-constants';

export type SystemDocumentResponse = {
  key: SystemDocumentKey;
  title: string;
  canonicalFilename: string;
  isUploaded: boolean;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  uploadedByUserId: number | null;
  fileUrl: string | null;
};

export type SystemDocumentListResponse = {
  items: SystemDocumentResponse[];
};

export type SystemDocumentFilePayload = {
  buffer: Buffer;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

