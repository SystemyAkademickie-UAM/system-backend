<?php

declare(strict_types=1);

function maq_idp_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function maq_idp_renderHeader(string $title): void
{
    echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . maq_idp_h($title) . ' — Local IdP users</title>';
    echo '<style>
      body { font-family: system-ui, sans-serif; margin: 2rem; max-width: 960px; color: #1a1a1a; }
      h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
      .muted { color: #555; margin-bottom: 1.5rem; }
      table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
      th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; }
      th { background: #f5f5f5; }
      .actions a, .actions button { margin-right: 0.5rem; }
      .error { color: #b00020; margin: 1rem 0; }
      .success { color: #0d6832; margin: 1rem 0; }
      label { display: block; margin-top: 1rem; font-weight: 600; }
      input, select { width: 100%; max-width: 28rem; padding: 0.4rem; margin-top: 0.25rem; }
      button, .btn { display: inline-block; padding: 0.45rem 0.9rem; margin-top: 1rem; cursor: pointer; }
      nav { margin-bottom: 1.5rem; }
      nav a { margin-right: 1rem; }
    </style></head><body>';
    echo '<nav><a href="index.php">Users</a><a href="create.php">Add user</a><a href="logout.php">Logout</a></nav>';
    echo '<h1>' . maq_idp_h($title) . '</h1>';
    echo '<p class="muted">Local SimpleSAMLphp IdP — development only. Changes apply on next login.</p>';
}

function maq_idp_renderFooter(): void
{
    echo '</body></html>';
}
