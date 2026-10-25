<?php
/**
 * Plugin Name: Sourov Agent
 * Description: Hostinger-Agent style AI copilot inside wp-admin: specialists, skill cards and live site context. Bring any OpenAI-compatible provider - add your API key, URL and model and it works.
 * Version:     1.0.1
 * Author:      Sourov
 * License:     GPL-2.0+
 * Text Domain: sourov-agent
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SA_VERSION', '1.0.1' );
define( 'SA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once SA_PLUGIN_DIR . 'includes/class-sa-settings.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-context.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-skills.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-conversations.php';
require_once SA_PLUGIN_DIR . 'includes/class-sa-chat.php';
require_once SA_PLUGIN_DIR . 'includes/admin-page.php';

add_action( 'plugins_loaded', 'sa_bootstrap' );
function sa_bootstrap() {
	SA_Settings::init();
	SA_Context::init();
	SA_Skills::init();
	SA_Conversations::init();
	SA_Chat::init();
	SA_Admin_Page::init();
}

register_activation_hook( __FILE__, 'sa_activate' );
function sa_activate() {
	SA_Conversations::register_cpt();
}
