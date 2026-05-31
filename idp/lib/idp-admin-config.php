<?php

declare(strict_types=1);

function maq_idp_admin_password(): string
{
    $password = getenv('IDP_ADMIN_PASSWORD');
    if ($password === false || $password === '') {
        return 'admin';
    }
    return $password;
}
