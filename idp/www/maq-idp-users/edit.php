<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';
require_once '/var/www/simplesamlphp/config/maq-idp/lib/users-store.php';

MaqIdpAdminAuth::requireAuth();

$originalUsername = trim((string) ($_GET['username'] ?? $_POST['originalUsername'] ?? ''));
if ($originalUsername === '') {
    header('Location: index.php?error=' . urlencode('Missing username.'));
    exit;
}

$user = MaqIdpUsersStore::findByUsername($originalUsername);
if ($user === null) {
    header('Location: index.php?error=' . urlencode('User not found.'));
    exit;
}

$error = null;
$values = [
    'username' => (string) ($user['username'] ?? ''),
    'password' => (string) ($user['password'] ?? ''),
    'displayName' => (string) ($user['displayName'] ?? ''),
    'mail' => (string) ($user['mail'] ?? ''),
    'role' => MaqIdpUsersStore::roleFromAffiliation($user['eduPersonAffiliation'] ?? []),
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
        MaqIdpUsersStore::updateUser($originalUsername, $values);
        header('Location: index.php?message=' . urlencode('User updated.'));
        exit;
    } catch (Throwable $exception) {
        $error = $exception->getMessage();
    }
}

require __DIR__ . '/_user-form.php';
