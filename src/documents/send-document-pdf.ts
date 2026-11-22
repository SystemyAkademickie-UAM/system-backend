import type { Response } from 'express';

import type { SystemDocumentFilePayload } from './documents-response-types';

function resolveContentDisposition(
  filename: string,
  downloadQuery: string | undefined,
): string {
  const isAttachment = downloadQuery === '1' || downloadQuery === 'true';
  const mode = isAttachment ? 'attachment' : 'inline';
  const asciiFilename = filename.replace(/[^\x20-\x7e]/g, '_');
  const encodedFilename = encodeURIComponent(filename);
  return `${mode}; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

/**
 * Writes PDF binary headers and payload to an Express response with UTF-8 safe Content-Disposition.
 */
export function sendDocumentPdfResponse(
  res: Response,
  payload: SystemDocumentFilePayload,
  downloadQuery: string | undefined,
): void {
  res.set({
    'Content-Type': payload.contentType,
    'Content-Disposition': resolveContentDisposition(payload.filename, downloadQuery),
    'Content-Length': String(payload.sizeBytes),
    'Cache-Control': 'no-cache',
  });
  res.send(payload.buffer);
}

