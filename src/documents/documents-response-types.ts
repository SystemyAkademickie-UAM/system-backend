import type { SystemDocumentKey } from '../constants/system-documents-constants';

export type PublicSystemDocumentResponse = {
  key: SystemDocumentKey;
  title: string;
  canonicalFilename: string;
  isUploaded: boolean;
  originalFilename: string | null;
  fileSizeBytes: number | null;
  uploadedAt: string | null;
  fileUrl: string | null;
};

export type PublicSystemDocumentListResponse = {
  items: PublicSystemDocumentResponse[];
};

export type SystemDocumentResponse = PublicSystemDocumentResponse & {
  uploadedByUserId: number | null;
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
