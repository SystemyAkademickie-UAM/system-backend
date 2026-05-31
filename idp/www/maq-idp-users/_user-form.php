<?php

declare(strict_types=1);

require __DIR__ . '/_layout.php';

$isEdit = ($originalUsername ?? '') !== '';
$formTitle = $isEdit ? 'Edit user' : 'Add user';
maq_idp_renderHeader($formTitle);

if (($error ?? null) !== null) {
    echo '<p class="error">' . maq_idp_h($error) . '</p>';
}
?>
<form method="post">
  <?php if ($isEdit) { ?>
    <input type="hidden" name="originalUsername" value="<?= maq_idp_h($originalUsername) ?>">
  <?php } ?>
  <label for="username">Username</label>
  <input id="username" name="username" value="<?= maq_idp_h($values['username']) ?>" required>

  <label for="password">Password</label>
  <input id="password" name="password" type="text" value="<?= maq_idp_h($values['password']) ?>" required>

  <label for="displayName">Display name</label>
  <input id="displayName" name="displayName" value="<?= maq_idp_h($values['displayName']) ?>">

  <label for="mail">Email</label>
  <input id="mail" name="mail" type="email" value="<?= maq_idp_h($values['mail']) ?>" placeholder="user@localhost.invalid">

  <label for="role">Role</label>
  <select id="role" name="role">
    <?php
    $roles = ['student' => 'Student', 'lecturer' => 'Lecturer', 'staff' => 'Staff'];
    foreach ($roles as $roleValue => $roleLabel) {
        $selected = ($values['role'] === $roleValue) ? ' selected' : '';
        echo '<option value="' . maq_idp_h($roleValue) . '"' . $selected . '>' . maq_idp_h($roleLabel) . '</option>';
    }
    ?>
  </select>

  <button type="submit"><?= $isEdit ? 'Save changes' : 'Create user' ?></button>
  <a class="btn" href="index.php">Cancel</a>
</form>
<?php maq_idp_renderFooter(); ?>
