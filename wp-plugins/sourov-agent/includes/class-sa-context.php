<?php
/**
 * Sourov Agent - live site context snapshot fed to the LLM system prompt.
 */

class SA_Context {

	public static function site_snapshot() {
		$theme = wp_get_theme();

		$post_count = 0;
		$page_count = 0;
		$posts = get_posts( array( 'numberposts' => 0, 'post_type' => 'post', 'fields' => 'ids', 'post_status' => 'publish' ) );
		$pages = get_posts( array( 'numberposts' => 0, 'post_type' => 'page', 'fields' => 'ids', 'post_status' => 'publish' ) );
		$post_count = count( $posts );
		$page_count = count( $pages );

		$recent = array();
		foreach ( get_posts( array( 'numberposts' => 5, 'post_type' => 'post', 'fields' => 'ids', 'post_status' => 'publish' ) ) as $id ) {
			$recent[] = array(
				'id'        => (int) $id,
				'slug'      => get_post_field( 'post_name', $id ),
				'title'     => mb_substr( get_the_title( $id ), 0, 80 ),
				'updated'   => get_post_field( 'post_modified', $id ),
			);
		}

		$plugin_names = array();
		foreach ( (array) get_option( 'active_plugins', array() ) as $p ) {
			$parts  = explode( '/', $p );
			$label  = end( $parts );
			$plugin_names[] = mb_substr( str_replace( array( '-plugin', '.php' ), '', $label ), 0, 48 );
		}

		$extra_creds = array();
		$s = SA_Settings::get();
		foreach ( $s['extra_creds'] as $c ) { // names only - values never leave the server
			$extra_creds[] = $c['name'];
		}

		return array(
			'site_title'          => get_bloginfo( 'name' ),
			'site_url'           => home_url( '/' ),
			'tagline'            => get_bloginfo( 'description' ),
			'wp_version'         => get_bloginfo( 'version' ),
			'php_version'        => PHP_VERSION,
			'theme'              => $theme ? $theme->get( 'Name' ) . ' ' . $theme->get( 'Version' ) : '',
			'published_posts'    => $post_count,
			'published_pages'    => $page_count,
			'active_plugins'     => array_slice( $plugin_names, 0, 30 ),
			'recent_posts'       => $recent,
			'server_cron_note'   => 'Hostinger shared hosting; system cron runs wp cron event run every 5 min; DISABLE_WP_CRON=true in wp-config.php.',
			'stored_credentials' => $extra_creds, // names only, values server-side
		);
	}

	/** Compact JSON block for the system prompt (capped). */
	public static function system_context_block() {
		$json = wp_json_encode( self::site_snapshot() );
		if ( strlen( $json ) > 8000 ) {
			$json = mb_substr( $json, 0, 8000 ) . '…(truncated)';
		}
		return $json;
	}

	public static function init() {}
}
