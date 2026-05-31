<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';

MaqIdpAdminAuth::logout();
header('Location: login.php');
exit;
