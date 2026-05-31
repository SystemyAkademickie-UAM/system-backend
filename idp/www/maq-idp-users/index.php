<?php

declare(strict_types=1);

require_once '/var/www/simplesamlphp/config/maq-idp/lib/admin-auth.php';
require_once '/var/www/simplesamlphp/config/maq-idp/lib/users-store.php';

MaqIdpAdminAuth::requireAuth();

$message = (string) ($_GET['message'] ?? '');
$error = (string) ($_GET['error'] ?? '');
$users = MaqIdpUsersStore::loadUsers();

require __DIR__ . '/_layout.php';
maq_idp_renderHeader('IdP users');
if ($message !== '') {
    echo '<p class="success">' . maq_idp_h($message) . '</p>';
}
if ($error !== '') {
    echo '<p class="error">' . maq_idp_h($error) . '</p>';
}
?>
<table>
  <thead>
    <tr>
      <th>Username</th>
      <th>Display name</th>
      <th>Mail</th>
      <th>Role</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <?php if (count($users) === 0) { ?>
      <tr><td colspan="5">No users yet.</td></tr>
    <?php } ?>
    <?php foreach ($users as $user) {
        $username = (string) ($user['username'] ?? '');
        $role = MaqIdpUsersStore::roleFromAffiliation($user['eduPersonAffiliation'] ?? []);
        ?>
      <tr>
        <td><?= maq_idp_h($username) ?></td>
        <td><?= maq_idp_h((string) ($user['displayName'] ?? '')) ?></td>
        <td><?= maq_idp_h((string) ($user['mail'] ?? '')) ?></td>
        <td><?= maq_idp_h($role) ?></td>
        <td class="actions">
          <a href="edit.php?username=<?= urlencode($username) ?>">Edit</a>
          <form method="post" action="delete.php" style="display:inline" onsubmit="return confirm('Delete user <?= maq_idp_h($username) ?>?');">
            <input type="hidden" name="username" value="<?= maq_idp_h($username) ?>">
            <button type="submit">Delete</button>
          </form>
        </td>
      </tr>
    <?php } ?>
  </tbody>
</table>
<p><a class="btn" href="create.php">Add user</a></p>
<?php maq_idp_renderFooter(); ?>
