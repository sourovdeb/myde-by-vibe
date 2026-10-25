<?php
/**
 * Plugin Name: Vibe MCP Bridge
 * Description: Bridge between Mistral AI and local MCP servers for browser control. v1.1.0 (2026-10-25): admin form to manually add/edit MCP server entries (name, url, tool list); previous values kept in a backup option for one-step rollback.
 * Version: 1.1.0
 * Author: Sourov Deb
 * Author URI: https://sourovdeb.com
 * License: GPL v2 or later
 */

if (!defined('ABSPATH')) {
    exit;
}

define('VIBE_MCP_BRIDGE_VERSION', '1.1.0');

register_activation_hook(__FILE__, function() {
    add_option('vibe_mcp_servers', array(
        'browser_control' => array(
            'name' => 'Browser Control MCP',
            'url' => 'http://localhost:3001',
            'tools' => array('browser_list_tabs', 'browser_new_tab', 'browser_switch_tab', 'browser_close_tab', 'browser_navigate', 'browser_get_page_info', 'browser_screenshot', 'browser_execute_js', 'browser_click', 'browser_type', 'browser_get_dom', 'browser_scroll', 'browser_wait_for_element', 'browser_get_element_text', 'browser_handle_dialog')
        ),
        'my_mcp_connector' => array(
            'name' => 'My MCP Connector',
            'url' => 'http://localhost:3000',
            'tools' => array('healthcheck', 'systeminfo', 'onestopshopstatus', 'credentialenvpresent', 'vibeskilllist')
        )
    ));
});

add_action('admin_menu', function() {
    add_menu_page('Vibe MCP Bridge', 'MCP Bridge', 'manage_options', 'vibe-mcp-bridge', function() {
        $servers = get_option('vibe_mcp_servers', array());

        /* --- save handler (POST + nonce + capability) --- */
        if ('POST' === $_SERVER['REQUEST_METHOD'] && current_user_can('manage_options')) {
            if (!isset($_POST['vmb_nonce']) || !wp_verify_nonce(sanitize_key(wp_unslash($_POST['vmb_nonce'])), 'vmb_save_servers')) {
                echo '<div class="notice notice-error"><p>Saved failed: nonce check failed.</p></div>';
                return;
            }
            $in = isset($_POST['servers']) && is_array($_POST['servers']) ? $_POST['servers'] : array();
            $clean = array();
            foreach ($in as $key => $row) {
                $key = sanitize_key($key);
                if ('' === $key) { continue; }
                $clean[$key] = array(
                    'name'  => isset($row['name']) ? sanitize_text_field(wp_unslash($row['name'])) : $key,
                    'url'   => isset($row['url']) ? esc_url_raw(wp_unslash($row['url'])) : '',
                    'tools' => isset($row['tools']) ? array_values(array_filter(array_map('trim', explode(',', sanitize_text_field(wp_unslash($row['tools'])))))) : array(),
                );
            }
            /* optional new server row */
            $nslug = isset($_POST['new_slug']) ? sanitize_key(wp_unslash($_POST['new_slug'])) : '';
            if ('' !== $nslug && !isset($clean[$nslug])) {
                $clean[$nslug] = array(
                    'name'  => isset($_POST['new_name']) ? sanitize_text_field(wp_unslash($_POST['new_name'])) : $nslug,
                    'url'   => isset($_POST['new_url']) ? esc_url_raw(wp_unslash($_POST['new_url'])) : '',
                    'tools' => isset($_POST['new_tools']) ? array_values(array_filter(array_map('trim', explode(',', sanitize_text_field(wp_unslash($_POST['new_tools'])))))) : array(),
                );
            }
            /* keep last-good value for one-step rollback */
            update_option('vibe_mcp_servers_last_backup', $servers);
            update_option('vibe_mcp_servers', $clean);
            wp_safe_redirect(add_query_arg('updated', '1', admin_url('admin.php?page=vibe-mcp-bridge')));
            exit;
        }

        if (isset($_GET['updated'])) {
            echo '<div class="notice notice-success is-dismissible"><p>Servers saved. Previous values kept in <code>vibe_mcp_servers_last_backup</code> (rollback = copy that option back over <code>vibe_mcp_servers</code>).</p></div>';
        }

        echo '<div class="wrap"><h1>Vibe MCP Bridge</h1><p>Active. Version ' . esc_html(VIBE_MCP_BRIDGE_VERSION) . '</p>';
        echo '<h2>MCP Servers</h2><ul>';
        foreach ($servers as $key => $server) {
            echo '<li><strong>' . esc_html(isset($server['name']) ? $server['name'] : $key) . '</strong>: <code>' . esc_html(isset($server['url']) ? $server['url'] : '') . '</code> (' . count(isset($server['tools']) ? $server['tools'] : array()) . ' tools)</li>';
        }
        echo '</ul>';

        echo '<form method="post">' . wp_nonce_field('vmb_save_servers', 'vmb_nonce', true, false);
        echo '<h2>Edit / Add servers</h2>';
        echo '<p class="description">Tools are a comma-separated list — informational for connector setup; the live server decides which tools it actually exposes.</p>';
        echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Key</th><th>Name</th><th>URL</th><th>Tools (comma-separated)</th></tr></thead><tbody>';
        foreach ($servers as $key => $server) {
            echo '<tr><td><code>' . esc_html($key) . '</code></td>'
               . '<td><input type="text" name="servers[' . esc_attr($key) . '][name]" value="' . esc_attr(isset($server['name']) ? $server['name'] : $key) . '"></td>'
               . '<td><input type="text" name="servers[' . esc_attr($key) . '][url]" value="' . esc_attr(isset($server['url']) ? $server['url'] : '') . '" style="width:260px"></td>'
               . '<td><input type="text" name="servers[' . esc_attr($key) . '][tools]" value="' . esc_attr(implode(', ', isset($server['tools']) ? $server['tools'] : array())) . '" style="width:100%"></td></tr>';
        }
        echo '<tr><td><input type="text" name="new_slug" placeholder="new_server_key" class="regular-text"></td>'
           . '<td><input type="text" name="new_name" placeholder="Display name"></td>'
           . '<td><input type="text" name="new_url" placeholder="http://localhost:3002"></td>'
           . '<td><input type="text" name="new_tools" placeholder="tool_a, tool_b" style="width:100%"></td></tr>';
        echo '</tbody></table>';
        echo '<p><button type="submit" class="button button-primary">Save servers</button></p>';
        echo '</form>';
        echo '<p>Add connectors at <a href="https://chat.mistral.ai/connections/marketplace" target="_blank">chat.mistral.ai/connections/marketplace</a></p>';
        echo '<p>Create workflows at <a href="https://console.mistral.ai/workflows" target="_blank">console.mistral.ai/workflows</a></p>';
        echo '</div>';
    }, 'dashicons-cloud', 30);
});
