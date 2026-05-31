<?php

declare(strict_types=1);

/**
 * JSON-backed user store for exampleauth:UserPass (local dev IdP only).
 */
final class MaqIdpUsersStore
{
    private const DATA_FILE = '/var/www/simplesamlphp/config/maq-idp/data/users.json';

    /** @var list<string> */
    private const ALLOWED_ROLES = ['student', 'lecturer', 'staff'];
    /** @return list<array<string, mixed>> */
    public static function loadUsers(): array
    {
        if (!is_readable(self::DATA_FILE)) {
            return [];
        }
        $raw = file_get_contents(self::DATA_FILE);
        if ($raw === false) {
            throw new RuntimeException('Could not read users file.');
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || !isset($decoded['users']) || !is_array($decoded['users'])) {
            throw new RuntimeException('Invalid users file format.');
        }
        return $decoded['users'];
    }

    /** @return array<string, array<string, list<string>>> UserPass entries for authsources.php */
    public static function loadUserPassEntries(): array
    {
        $entries = [];
        foreach (self::loadUsers() as $user) {
            $username = (string) ($user['username'] ?? '');
            $password = (string) ($user['password'] ?? '');
            if ($username === '' || $password === '') {
                continue;
            }
            $entries[$username . ':' . $password] = self::toAttributeArray($user);
        }
        return $entries;
    }

    /** @param array<string, mixed> $user */
    private static function toAttributeArray(array $user): array
    {
        return [
            'uid' => [(string) ($user['uid'] ?? $user['username'] ?? '')],
            'eduPersonAffiliation' => self::stringList($user['eduPersonAffiliation'] ?? []),
            'eduPersonPrincipalName' => [(string) ($user['eduPersonPrincipalName'] ?? '')],
            'mail' => [(string) ($user['mail'] ?? '')],
            'displayName' => [(string) ($user['displayName'] ?? '')],
        ];
    }

    /** @param mixed $value @return list<string> */
    private static function stringList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $items = [];
        foreach ($value as $item) {
            $text = trim((string) $item);
            if ($text !== '') {
                $items[] = $text;
            }
        }
        return $items;
    }

    /** @param list<array<string, mixed>> $users */
    public static function saveUsers(array $users): void
    {
        $payload = json_encode(['users' => $users], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if ($payload === false) {
            throw new RuntimeException('Could not encode users file.');
        }
        $payload .= "\n";
        $tempFile = self::DATA_FILE . '.tmp';
        $written = file_put_contents($tempFile, $payload, LOCK_EX);
        if ($written === false) {
            throw new RuntimeException('Could not write users file.');
        }
        if (!rename($tempFile, self::DATA_FILE)) {
            @unlink($tempFile);
            throw new RuntimeException('Could not replace users file.');
        }
    }
    public static function findByUsername(string $username): ?array
    {
        foreach (self::loadUsers() as $user) {
            if (($user['username'] ?? '') === $username) {
                return $user;
            }
        }
        return null;
    }

    /** @param array<string, mixed> $user */
    public static function createUser(array $user): void
    {
        $username = trim((string) ($user['username'] ?? ''));
        if ($username === '') {
            throw new InvalidArgumentException('Username is required.');
        }
        if (self::findByUsername($username) !== null) {
            throw new InvalidArgumentException('Username already exists.');
        }
        $users = self::loadUsers();
        $users[] = self::normalizeUserInput($user);
        self::saveUsers($users);
    }

    /** @param array<string, mixed> $user */
    public static function updateUser(string $originalUsername, array $user): void
    {
        $users = self::loadUsers();
        $found = false;
        $normalized = self::normalizeUserInput($user);
        foreach ($users as $index => $existing) {
            if (($existing['username'] ?? '') !== $originalUsername) {
                continue;
            }
            $newUsername = (string) ($normalized['username'] ?? '');
            if ($newUsername !== $originalUsername && self::findByUsername($newUsername) !== null) {
                throw new InvalidArgumentException('Username already exists.');
            }
            $users[$index] = $normalized;
            $found = true;
            break;
        }
        if (!$found) {
            throw new InvalidArgumentException('User not found.');
        }
        self::saveUsers($users);
    }

    public static function deleteUser(string $username): void
    {
        $users = self::loadUsers();
        $next = [];
        $found = false;
        foreach ($users as $user) {
            if (($user['username'] ?? '') === $username) {
                $found = true;
                continue;
            }
            $next[] = $user;
        }
        if (!$found) {
            throw new InvalidArgumentException('User not found.');
        }
        self::saveUsers($next);
    }

    /** @param array<string, mixed> $input @return array<string, mixed> */
    public static function normalizeUserInput(array $input): array
    {
        $username = trim((string) ($input['username'] ?? ''));
        $password = (string) ($input['password'] ?? '');
        $displayName = trim((string) ($input['displayName'] ?? ''));
        $mail = trim((string) ($input['mail'] ?? ''));
        $role = trim((string) ($input['role'] ?? 'student'));
        if (!in_array($role, self::ALLOWED_ROLES, true)) {
            throw new InvalidArgumentException('Invalid role.');
        }        if ($username === '') {
            throw new InvalidArgumentException('Username is required.');
        }
        if ($password === '') {
            throw new InvalidArgumentException('Password is required.');
        }
        if ($displayName === '') {
            $displayName = $username;
        }
        if ($mail === '') {
            $mail = $username . '@localhost.invalid';
        }
        $affiliation = self::affiliationForRole($role);
        return [
            'username' => $username,
            'password' => $password,
            'uid' => $username,
            'eduPersonAffiliation' => $affiliation,
            'eduPersonPrincipalName' => $mail,
            'mail' => $mail,
            'displayName' => $displayName,
        ];
    }

    /** @return list<string> */
    public static function affiliationForRole(string $role): array
    {
        if ($role === 'lecturer' || $role === 'faculty') {
            return ['faculty', 'member'];
        }
        if ($role === 'staff') {
            return ['staff', 'member'];
        }
        return ['student', 'member'];
    }

    public static function roleFromAffiliation(array $affiliation): string
    {
        $values = self::stringList($affiliation);
        if (in_array('faculty', $values, true)) {
            return 'lecturer';
        }
        if (in_array('staff', $values, true)) {
            return 'staff';
        }
        return 'student';
    }
}
