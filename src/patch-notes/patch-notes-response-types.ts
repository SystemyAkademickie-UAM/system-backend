export type PatchNoteResponse = {
  id: number;
  title: string;
  version: string | null;
  originalFilename: string;
  fileSizeBytes: number;
  uploadedByUserId: number | null;
  createdAt: string;
  fileUrl: string;
};

export type PatchNoteListResponse = {
  items: PatchNoteResponse[];
  total: number;
};

export type PatchNoteFilePayload = {
  buffer: Buffer;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

