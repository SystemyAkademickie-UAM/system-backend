<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';

MaqIdpAdminAuth::startSession();
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string) ($_POST['password'] ?? '');
    if (MaqIdpAdminAuth::login($password)) {
        header('Location: index.php');
        exit;
    }
    $error = 'Invalid administrator password.';
}

if (MaqIdpAdminAuth::isAuthenticated()) {
    header('Location: index.php');
    exit;
}

require __DIR__ . '/_layout.php';
maq_idp_renderHeader('Administrator login');
if ($error !== null) {
    echo '<p class="error">' . maq_idp_h($error) . '</p>';
}
?>
<form method="post">
  <label for="password">Administrator password</label>
  <input id="password" name="password" type="password" required autofocus>
  <button type="submit">Sign in</button>
</form>
<?php maq_idp_renderFooter(); ?>
