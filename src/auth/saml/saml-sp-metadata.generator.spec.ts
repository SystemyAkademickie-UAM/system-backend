import {
  SAML_BINDING_HTTP_ARTIFACT,
  SAML_BINDING_HTTP_POST,
  SAML_BINDING_HTTP_REDIRECT,
  SAML_METADATA_XML_NS,
  SAML_PROTOCOL_ENUMERATION,
} from '../../constants/saml-constants';
import { generateDefaultSpStyleMetadataXml } from './saml-sp-metadata.generator';

describe('generateDefaultSpStyleMetadataXml', () => {
  const baseParams = {
    entityId: 'https://sp.example.test/metadata',
    acsUrl: 'https://sp.example.test/module.php/saml/sp/saml2-acs.php/default-sp',
    sloRedirectUrl: 'https://sp.example.test/module.php/saml/sp/saml2-logout.php/default-sp',
    technicalContact: { givenName: 'MP', emailAddress: 'mailto:mplaczek@amu.edu.pl' },
  } as const;

  it('matches UAM default-sp structural template without artifact ACS by default (no ds / no X509)', () => {
    const xml = generateDefaultSpStyleMetadataXml({
      ...baseParams,
      includeArtifactAssertionConsumerService: false,
    });
    const expected = `<?xml version="1.0" encoding="utf-8"?>
<md:EntityDescriptor xmlns:md="${SAML_METADATA_XML_NS}" entityID="https://sp.example.test/metadata">
  <md:SPSSODescriptor protocolSupportEnumeration="${SAML_PROTOCOL_ENUMERATION}">
    <md:SingleLogoutService Binding="${SAML_BINDING_HTTP_REDIRECT}" Location="https://sp.example.test/module.php/saml/sp/saml2-logout.php/default-sp"/>
    <md:AssertionConsumerService Binding="${SAML_BINDING_HTTP_POST}" Location="https://sp.example.test/module.php/saml/sp/saml2-acs.php/default-sp" index="0"/>
  </md:SPSSODescriptor>
  <md:ContactPerson contactType="technical">
    <md:GivenName>MP</md:GivenName>
    <md:EmailAddress>mailto:mplaczek@amu.edu.pl</md:EmailAddress>
  </md:ContactPerson>
</md:EntityDescriptor>
`;
    expect(xml).toBe(expected);
    expect(xml).not.toContain('xmlns:ds');
    expect(xml).not.toContain('X509Certificate');
  });

  it('adds HTTP-Artifact ACS when includeArtifactAssertionConsumerService is true', () => {
    const xml = generateDefaultSpStyleMetadataXml({
      ...baseParams,
      includeArtifactAssertionConsumerService: true,
    });
    expect(xml).toContain(
      `<md:AssertionConsumerService Binding="${SAML_BINDING_HTTP_ARTIFACT}" Location="https://sp.example.test/module.php/saml/sp/saml2-acs.php/default-sp" index="1"/>`,
    );
  });

  it('escapes ampersand in URLs and entityID', () => {
    const xml = generateDefaultSpStyleMetadataXml({
      entityId: 'https://sp.example.test/meta&id=1',
      acsUrl: 'https://sp.example.test/acs',
      sloRedirectUrl: 'https://sp.example.test/slo',
      technicalContact: { givenName: 'A', emailAddress: 'a@b.co' },
      includeArtifactAssertionConsumerService: false,
    });
    expect(xml).toContain('entityID="https://sp.example.test/meta&amp;id=1"');
  });

  it('prefixes mailto when omitted on email', () => {
    const xml = generateDefaultSpStyleMetadataXml({
      ...baseParams,
      technicalContact: { givenName: 'X', emailAddress: ' u@example.test ' },
      includeArtifactAssertionConsumerService: false,
    });
    expect(xml).toContain('<md:EmailAddress>mailto:u@example.test</md:EmailAddress>');
  });
});
