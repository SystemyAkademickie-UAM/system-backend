<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';
require_once '/var/www/simplesamlphp/config/maq-idp/lib/users-store.php';

MaqIdpAdminAuth::requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: index.php');
    exit;
}

$username = trim((string) ($_POST['username'] ?? ''));
try {
    MaqIdpUsersStore::deleteUser($username);
    header('Location: index.php?message=' . urlencode('User deleted.'));
} catch (Throwable $exception) {
    header('Location: index.php?error=' . urlencode($exception->getMessage()));
}
exit;
