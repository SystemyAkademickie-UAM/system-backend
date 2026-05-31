<?php

/**
 * Add MyAcademyQuest IdP user management link to the configuration frontpage.
 *
 * The frontpage hook is also invoked from the portal module with a minimal
 * { links: [] } payload — only act when the config section is present.
 *
 * @param array<string, mixed> $links
 */
function maqidp_hook_frontpage(&$links)
{
    if (!is_array($links) || !array_key_exists('config', $links) || !is_array($links['config'])) {
        return;
    }

    $links['config']['maq_idp_users'] = [
        'href' => rtrim(\SimpleSAML\Utils\HTTP::getBaseURL(), '/') . '/maq-idp-users/edit.php?username=student',
        'text' => \SimpleSAML\Locale\Translate::noop('Manage IdP users (edit student)'),
    ];
}
