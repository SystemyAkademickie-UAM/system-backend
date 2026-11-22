import { join } from 'node:path';

import { resolveDriveStorageRoot } from './drive-service-constants';

/** Environment variable overriding the storage directory for system PDF documents. */
export const DOCUMENTS_STORAGE_DIR_ENV = 'DOCUMENTS_STORAGE_DIR';

/** Subdirectory under the drive storage root used when DOCUMENTS_STORAGE_DIR is unset. */
export const DOCUMENTS_STORAGE_SUBDIR = 'documents';

/** Default maximum upload size for a system PDF document (20 MiB). */
export const DOCUMENTS_MAX_FILE_BYTES_DEFAULT = 20 * 1024 * 1024;

const parsedMaxBytes = Number.parseInt(process.env.DOCUMENTS_MAX_FILE_BYTES ?? '', 10);

/** Maximum allowed size in bytes for an uploaded system document PDF. */
export const DOCUMENTS_MAX_FILE_BYTES =
  Number.isFinite(parsedMaxBytes) && parsedMaxBytes > 0
    ? parsedMaxBytes
    : DOCUMENTS_MAX_FILE_BYTES_DEFAULT;

/** Expected MIME type for system documents. */
export const DOCUMENTS_CONTENT_TYPE = 'application/pdf';

/** Required file extension for system documents. */
export const DOCUMENTS_FILE_EXTENSION = '.pdf';

/** ASCII magic header prefix present at the beginning of every valid PDF file. */
export const DOCUMENTS_PDF_MAGIC_HEADER = '%PDF-';

/** Maximum length for document key identifier. */
export const DOCUMENTS_KEY_MAX_LENGTH = 64;

/** Maximum length for document display title. */
export const DOCUMENTS_TITLE_MAX_LENGTH = 200;

/** Maximum length for original uploaded filename. */
export const DOCUMENTS_FILENAME_MAX_LENGTH = 255;

/** Maximum length for stored filename on disk. */
export const DOCUMENTS_STORAGE_KEY_MAX_LENGTH = 128;

export type SystemDocumentKey = 'termsOfUse' | 'privacyPolicy' | 'documentation';

export type SystemDocumentDefinition = {
  readonly key: SystemDocumentKey;
  readonly defaultTitle: string;
  readonly canonicalFilename: string;
};

/** Predefined application documents managed by super-administrators. */
export const SYSTEM_DOCUMENT_DEFINITIONS: readonly SystemDocumentDefinition[] = [
  {
    key: 'termsOfUse',
    defaultTitle: 'Terms of Use',
    canonicalFilename: 'warunki-uzytkowania.pdf',
  },
  {
    key: 'privacyPolicy',
    defaultTitle: 'Privacy Policy',
    canonicalFilename: 'polityka-prywatnosci.pdf',
  },
  {
    key: 'documentation',
    defaultTitle: 'Documentation',
    canonicalFilename: 'dokumentacja.pdf',
  },
] as const;

const DOCUMENT_KEY_ALIASES: Readonly<Record<string, SystemDocumentKey>> = {
  termsofuse: 'termsOfUse',
  'terms-of-use': 'termsOfUse',
  terms_of_use: 'termsOfUse',
  'warunki-uzytkowania': 'termsOfUse',
  'warunki-uzytkowania.pdf': 'termsOfUse',
  privacypolicy: 'privacyPolicy',
  'privacy-policy': 'privacyPolicy',
  privacy_policy: 'privacyPolicy',
  'polityka-prywatnosci': 'privacyPolicy',
  'polityka-prywatnosci.pdf': 'privacyPolicy',
  documentation: 'documentation',
  dokumentacja: 'documentation',
  'dokumentacja.pdf': 'documentation',
};

/**
 * Resolves a raw document key or filename alias to its canonical SystemDocumentDefinition.
 */
export function resolveSystemDocumentDefinition(
  rawKey: string,
): SystemDocumentDefinition | null {
  const normalized = rawKey.trim().toLowerCase();
  const matchedKey = DOCUMENT_KEY_ALIASES[normalized];
  if (!matchedKey) {
    return null;
  }
  return (
    SYSTEM_DOCUMENT_DEFINITIONS.find((def) => def.key === matchedKey) ?? null
  );
}

/**
 * Resolves the directory on disk where system PDF documents are stored.
 */
export function resolveDocumentsStorageDir(): string {
  const customDir = process.env[DOCUMENTS_STORAGE_DIR_ENV]?.trim();
  if (customDir && customDir.length > 0) {
    return customDir;
  }
  return join(resolveDriveStorageRoot(), DOCUMENTS_STORAGE_SUBDIR);
}

