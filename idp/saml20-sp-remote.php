<?php

$defaultEntityId = 'http://127.0.0.1:8080/api/auth/saml/metadata';
$defaultAcsUrl = 'http://127.0.0.1:3000/api/auth/saml/acs';
$defaultSloUrl = 'http://127.0.0.1:3000/api/auth/saml/slo';

$spEntityId = getenv('SAML_SP_ENTITY_ID') ?: getenv('SIMPLESAMLPHP_SP_ENTITY_ID') ?: $defaultEntityId;
$acsUrl = getenv('SAML_ACS_URL') ?: getenv('SIMPLESAMLPHP_SP_ASSERTION_CONSUMER_SERVICE') ?: $defaultAcsUrl;
$sloUrl = getenv('SAML_SLO_URL') ?: getenv('SIMPLESAMLPHP_SP_SINGLE_LOGOUT_SERVICE') ?: $defaultSloUrl;

$metadata[$spEntityId] = [
    'AssertionConsumerService' => [
        [
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            'Location' => $acsUrl,
            'index' => 0,
            'isDefault' => true,
        ],
    ],
    'SingleLogoutService' => [
        [
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
            'Location' => $sloUrl,
        ],
        [
            'Binding' => 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
            'Location' => $sloUrl,
        ],
    ],
    'NameIDFormat' => 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
    'validate.authnrequest' => false,
    'WantAssertionsSigned' => true,
];
