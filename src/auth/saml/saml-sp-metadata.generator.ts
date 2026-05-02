import {
  SAML_BINDING_HTTP_ARTIFACT,
  SAML_BINDING_HTTP_POST,
  SAML_BINDING_HTTP_REDIRECT,
  SAML_METADATA_XML_NS,
  SAML_PROTOCOL_ENUMERATION,
} from '../../constants/saml-constants';

export type SamlSpMetadataTechnicalContact = {
  givenName: string;
  emailAddress: string;
};

export type GenerateDefaultSpStyleMetadataXmlParams = {
  entityId: string;
  acsUrl: string;
  sloRedirectUrl: string;
  technicalContact: SamlSpMetadataTechnicalContact;
  /** Second ACS row (HTTP-Artifact, index 1). Runtime ACS remains POST-only unless you add artifact resolution. */
  includeArtifactAssertionConsumerService: boolean;
};

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function normalizeMailto(emailOrMailto: string): string {
  const trimmed = emailOrMailto.trim();
  if (trimmed.toLowerCase().startsWith('mailto:')) {
    return trimmed;
  }
  return `mailto:${trimmed}`;
}

/**
 * SP metadata XML aligned with UAM SimpleSAMLphp `default-sp` samples:
 * only `md:` prefix on `EntityDescriptor`, no `ds:` / no X509 block.
 * HTTP-Artifact ACS is omitted unless `includeArtifactAssertionConsumerService` is true (matches POST-only runtime by default).
 *
 * The IdP must obtain your signing key **outside** this document (as they often do when registering SP certs manually).
 */
export function generateDefaultSpStyleMetadataXml(params: GenerateDefaultSpStyleMetadataXmlParams): string {
  const entityId = escapeXmlAttribute(params.entityId);
  const acs = escapeXmlAttribute(params.acsUrl);
  const slo = escapeXmlAttribute(params.sloRedirectUrl.trim());
  const given = escapeXmlText(params.technicalContact.givenName.trim());
  const email = escapeXmlText(normalizeMailto(params.technicalContact.emailAddress.trim()));
  const artifactAcsLine = params.includeArtifactAssertionConsumerService
    ? `\n    <md:AssertionConsumerService Binding="${escapeXmlAttribute(SAML_BINDING_HTTP_ARTIFACT)}" Location="${acs}" index="1"/>`
    : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<md:EntityDescriptor xmlns:md="${escapeXmlAttribute(SAML_METADATA_XML_NS)}" entityID="${entityId}">
  <md:SPSSODescriptor protocolSupportEnumeration="${escapeXmlAttribute(SAML_PROTOCOL_ENUMERATION)}">
    <md:SingleLogoutService Binding="${escapeXmlAttribute(SAML_BINDING_HTTP_REDIRECT)}" Location="${slo}"/>
    <md:AssertionConsumerService Binding="${escapeXmlAttribute(SAML_BINDING_HTTP_POST)}" Location="${acs}" index="0"/>${artifactAcsLine}
  </md:SPSSODescriptor>
  <md:ContactPerson contactType="technical">
    <md:GivenName>${given}</md:GivenName>
    <md:EmailAddress>${email}</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>
`;
}
