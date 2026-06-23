/**
 * Parses IdP SAML metadata XML into SSO endpoints and signing certificate PEM.
 */
import dns from 'node:dns/promises';
import net from 'node:net';

import {
  IDP_METADATA_FETCH_MAX_BYTES,
  IDP_METADATA_FETCH_TIMEOUT_MS,
} from '../../constants/idp-metadata-fetch-constants';

export type ParsedIdpMetadata = {
  entityId: string;
  ssoLoginUrl: string;
  ssoLogoutUrl: string | null;
  signingCertificatePem: string;
};

function firstMatch(xml: string, pattern: RegExp): string | null {
  const match = xml.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function extractSigningCertificatePem(xml: string): string {
  const signingBlock = firstMatch(
    xml,
    /<(?:[\w:]+:)?KeyDescriptor[^>]*use="signing"[^>]*>([\s\S]*?)<\/(?:[\w:]+:)?KeyDescriptor>/i);
  const searchIn = signingBlock ?? xml;
  const body = firstMatch(searchIn, /<(?:[\w:]+:)?X509Certificate>([^<]+)<\/(?:[\w:]+:)?X509Certificate>/i);
  if (body === null) {
    throw new Error('No signing X509Certificate found in IdP metadata');
  }
  const normalized = body.replace(/\s+/g, '');
  return `-----BEGIN CERTIFICATE-----\n${normalized.match(/.{1,64}/g)?.join('\n') ?? normalized}\n-----END CERTIFICATE-----\n`;
}

function extractSsoLoginUrl(xml: string): string {
  const url = firstMatch(
    xml,
    /<(?:[\w:]+:)?SingleSignOnService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]+)"/i) ?? firstMatch(
    xml,
    /<(?:[\w:]+:)?SingleSignOnService[^>]*Location="([^"]+)"[^>]*Binding="[^"]*HTTP-Redirect/i) ?? firstMatch(xml, /<(?:[\w:]+:)?SingleSignOnService[^>]*Location="([^"]+)"/i);
  if (url === null) {
    throw new Error('No SingleSignOnService Location found in IdP metadata');
  }
  return url;
}

function extractSloLogoutUrl(xml: string): string | null {
  return (
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleLogoutService[^>]*Binding="[^"]*HTTP-Redirect[^"]*"[^>]*Location="([^"]+)"/i) ??
    firstMatch(
      xml,
      /<(?:[\w:]+:)?SingleLogoutService[^>]*Location="([^"]+)"[^>]*Binding="[^"]*HTTP-Redirect/i) ??
    firstMatch(xml, /<(?:[\w:]+:)?SingleLogoutService[^>]*Location="([^"]+)"/i)
  );
}

function isLocalDevMetadataHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function isBlockedMetadataAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split('.').map((part) => Number.parseInt(part, 10));
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
      return true;
    }
    const [a, b] = parts;
    if (a === 10) {
      return true;
    }
    if (a === 127) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 0) {
      return true;
    }
    return false;
  }
  if (version === 6) {
    const normalized = address.toLowerCase();
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80');
  }
  return true;
}

/**
 * Validates metadata URL scheme and resolved addresses before server-side fetch.
 */
export async function assertSafeMetadataUrl(metadataUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(metadataUrl);
  } catch {
    throw new Error('Invalid metadata URL');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocalDevMetadataHost(parsed.hostname))) {
    throw new Error('Metadata URL must use HTTPS (HTTP is allowed only for localhost / 127.0.0.1)');
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new Error('Metadata URL must not include credentials');
  }
  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error('Metadata URL hostname could not be resolved');
  }
  for (const entry of addresses) {
    if (isLocalDevMetadataHost(parsed.hostname)) {
      continue;
    }
    if (isBlockedMetadataAddress(entry.address)) {
      throw new Error('Metadata URL must not target private or link-local networks');
    }
  }
  return parsed;
}

/**
 * Parses federation metadata XML document.
 */
export function parseIdpMetadataXml(xml: string): ParsedIdpMetadata {
  const entityId =
    firstMatch(xml, /<(?:[\w:]+:)?EntityDescriptor[^>]*entityID="([^"]+)"/i) ??
    firstMatch(xml, /entityID="([^"]+)"/i);
  if (entityId === null) {
    throw new Error('No entityID found in IdP metadata');
  }
  return {
    entityId,
    ssoLoginUrl: extractSsoLoginUrl(xml),
    ssoLogoutUrl: extractSloLogoutUrl(xml),
    signingCertificatePem: extractSigningCertificatePem(xml),
  };
}

/**
 * Fetches and parses IdP metadata from a remote metadata URL.
 */
export async function fetchIdpMetadata(metadataUrl: string): Promise<ParsedIdpMetadata> {
  await assertSafeMetadataUrl(metadataUrl);
  const response = await fetch(metadataUrl, {
    signal: AbortSignal.timeout(IDP_METADATA_FETCH_TIMEOUT_MS),
    redirect: 'error',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch IdP metadata (${response.status}) from ${metadataUrl}`);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > IDP_METADATA_FETCH_MAX_BYTES) {
    throw new Error(`IdP metadata response exceeds ${IDP_METADATA_FETCH_MAX_BYTES} bytes`);
  }
  const xml = new TextDecoder('utf-8').decode(buffer);
  return parseIdpMetadataXml(xml);
}
