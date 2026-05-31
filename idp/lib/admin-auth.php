<?php

declare(strict_types=1);

final class MaqIdpAdminAuth
{
    private const SESSION_KEY = 'maq_idp_admin_authenticated';

    public static function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_start();
        }
    }

    public static function isAuthenticated(): bool
    {
        self::startSession();
        return ($_SESSION[self::SESSION_KEY] ?? false) === true;
    }

    public static function login(string $password): bool
    {
        require_once __DIR__ . '/idp-admin-config.php';
        if (!hash_equals(maq_idp_admin_password(), $password)) {
            return false;
        }
        self::startSession();
        session_regenerate_id(true);
        $_SESSION[self::SESSION_KEY] = true;
        return true;
    }
    public static function logout(): void
    {
        self::startSession();
        unset($_SESSION[self::SESSION_KEY]);
    }

    public static function requireAuth(): void
    {
        if (self::isAuthenticated()) {
            return;
        }
        header('Location: login.php');
        exit;
    }
}
