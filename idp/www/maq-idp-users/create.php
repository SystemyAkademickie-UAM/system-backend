<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';
require_once '/var/www/simplesamlphp/config/maq-idp/lib/users-store.php';

MaqIdpAdminAuth::requireAuth();

$error = null;
$values = [
    'username' => '',
    'password' => '',
    'displayName' => '',
    'mail' => '',
    'role' => 'student',
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $values = [
        'username' => trim((string) ($_POST['username'] ?? '')),
        'password' => (string) ($_POST['password'] ?? ''),
        'displayName' => trim((string) ($_POST['displayName'] ?? '')),
        'mail' => trim((string) ($_POST['mail'] ?? '')),
        'role' => trim((string) ($_POST['role'] ?? 'student')),
    ];
    try {
        MaqIdpUsersStore::createUser($values);
        header('Location: index.php?message=' . urlencode('User created.'));
        exit;
    } catch (Throwable $exception) {
        $error = $exception->getMessage();
    }
}

require __DIR__ . '/_user-form.php';
