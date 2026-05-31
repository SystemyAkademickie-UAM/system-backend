import { createHash, X509Certificate } from 'node:crypto';

/**
 * Normalizes PEM text for parsing and storage.
 */
export function normalizePemCertificate(pem: string): string {
  return pem
    .replace(/^\uFEFF/, '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Computes SHA-256 fingerprint (hex, lowercase) of the DER-encoded certificate.
 */
export function computeCertificateFingerprintSha256(pem: string): string {
  const normalized = normalizePemCertificate(pem);
  const cert = new X509Certificate(normalized);
  return createHash('sha256').update(cert.raw).digest('hex');
}

/**
 * Parses validity window from an X.509 PEM certificate.
 */
export function parseCertificateValidity(pem: string): { validFrom: Date | null; validUntil: Date | null } {
  const normalized = normalizePemCertificate(pem);
  const cert = new X509Certificate(normalized);
  return {
    validFrom: cert.validFrom ? new Date(cert.validFrom) : null,
    validUntil: cert.validTo ? new Date(cert.validTo) : null,
  };
}

/**
 * Verifies stored fingerprint matches the PEM certificate body.
 */
export function verifyCertificateFingerprint(pem: string, expectedFingerprint: string): boolean {
  const actual = computeCertificateFingerprintSha256(pem);
  return actual.toLowerCase() === expectedFingerprint.trim().toLowerCase();
}
