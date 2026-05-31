<?php

require_once __DIR__ . '/maq-idp/lib/idp-admin-config.php';
require_once __DIR__ . '/maq-idp/lib/users-store.php';

$adminPassword = maq_idp_admin_password();

$config = [
    'admin' => [
        'core:AdminPassword',
        $adminPassword,
    ],
    'example-userpass' => array_merge(
        ['exampleauth:UserPass'],
        MaqIdpUsersStore::loadUserPassEntries(),
    ),
];

$config['default-sp'] = 'example-userpass';
