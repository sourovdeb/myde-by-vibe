<?php
/**
 * Sourov Agent - provider settings (option 'sa_settings').
 * The API key never leaves the server: REST GET returns only has_key + key length.
 */

class SA_Settings {

	const OPTION = 'sa_settings';

	public static function defaults() {
		return array(
			'base_url'     => '',
			'api_key'      => '',
			'model'        => '',
			'temperature'  => 0.7,
			'max_tokens'   => 2000,
			'greeting_name'=> 'Sourov',
			'extra_creds'  => array(), // [ {name, value} ] - stored server-side, listed by name only
		);
	}

	public static function get() {
		$s = get_option( self::OPTION );
		if ( ! is_array( $s ) ) {
			$s = array();
		}
		return wp_parse_args( $s, self::defaults() );
	}

	/** Masked view for the browser: everything except the key value itself. */
	public static function public_view() {
		$s = self::get();
		return array(
			'base_url'     => $s['base_url'],
			'has_key'      => ! empty( $s['api_key'] ),
			'key_len'      => strlen( (string) $s['api_key'] ),
			'model'        => $s['model'],
			'temperature'  => (float) $s['temperature'],
			'max_tokens'   => (int) $s['max_tokens'],
			'greeting_name'=> $s['greeting_name'],
			'extra_creds'  => array_map( function ( $c ) {
				return array( 'name' => isset( $c['name'] ) ? $c['name'] : '', 'has_value' => ! empty( $c['value'] ) );
			}, $s['extra_creds'] ),
			'configured'   => ! empty( $s['base_url'] ) && ! empty( $s['api_key'] ) && ! empty( $s['model'] ),
		);
	}

	/** Validate + store. Returns array(ok, error). */
	public static function save( $input ) {
		$in  = is_array( $input ) ? $input : array();
		$cur = self::get();

		$base_url = isset( $in['base_url'] ) ? esc_url_raw( trim( (string) $in['base_url'] ) ) : '';
		if ( $base_url !== '' ) {
			$parts = parse_url( $base_url );
			if ( ! $parts || empty( $parts['host'] ) || ! in_array( isset( $parts['scheme'] ) ? $parts['scheme'] : '', array( 'http', 'https' ), true ) ) {
				return array( 'ok' => false, 'error' => 'Invalid base URL (need http/https).' );
			}
		}

		// Keep the existing key when the client sends a blank key field (meaning "unchanged").
		$api_key = isset( $in['api_key'] ) ? trim( (string) $in['api_key'] ) : $cur['api_key'];
		if ( ! empty( $in['api_key'] ) && strlen( $api_key ) < 8 ) {
			return array( 'ok' => false, 'error' => 'API key looks too short.' );
		}

		$model = isset( $in['model'] ) ? sanitize_text_field( trim( (string) $in['model'] ) ) : '';
		if ( $model !== '' && mb_strlen( $model ) > 120 ) {
			return array( 'ok' => false, 'error' => 'Model name too long.' );
		}

		$temperature = isset( $in['temperature'] ) ? (float) $in['temperature'] : 0.7;
		$temperature = max( 0, min( 2.0, $temperature ) );

		$max_tokens = isset( $in['max_tokens'] ) ? (int) $in['max_tokens'] : 2000;
		$max_tokens = max( 256, min( 16384, $max_tokens ) );

		$greeting = isset( $in['greeting_name'] ) ? sanitize_text_field( trim( (string) $in['greeting_name'] ) ) : 'Sourov';
		if ( mb_strlen( $greeting ) > 60 ) {
			$greeting = 'Sourov';
		}

		$creds = array();
		if ( isset( $in['extra_creds'] ) && is_array( $in['extra_creds'] ) ) {
			foreach ( array_slice( $in['extra_creds'], 0, 20 ) as $c ) {
				if ( ! is_array( $c ) ) {
					continue;
				}
				$name  = sanitize_text_field( trim( isset( $c['name'] ) ? (string) $c['name'] : '' ) );
				$value = isset( $c['value'] ) ? (string) $c['value'] : '';
				if ( $name === '' || mb_strlen( $name ) > 60 ) {
					continue;
				}
				if ( strlen( $value ) > 500 ) {
					$value = mb_substr( $value, 0, 500 );
				}
				$creds[] = array( 'name' => $name, 'value' => $value );
			}
		}

		$saved = array(
			'base_url'     => $base_url,
			'api_key'      => $api_key,
			'model'        => $model,
			'temperature'  => $temperature,
			'max_tokens'   => $max_tokens,
			'greeting_name'=> $greeting,
			'extra_creds'  => $creds,
		);
		update_option( self::OPTION, $saved );
		return array( 'ok' => true, 'error' => '' );
	}

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest' ) );
	}

	public static function register_rest() {
		register_rest_route( 'sa/v1', '/settings', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( __CLASS__, 'rest_get' ), 'permission_callback' => 'sa_rest_permission' ),
			array( 'methods' => WP_REST_Server::CREATABLE, 'callback' => array( __CLASS__, 'rest_save' ), 'permission_callback' => 'sa_rest_permission' ),
		) );
	}

	public static function rest_get() {
		return rest_ensure_response( self::public_view() );
	}

	public static function rest_save( $request ) {
		$r = self::save( $request->get_params() );
		if ( ! $r['ok'] ) {
			return new WP_Error( 'sa_settings_invalid', $r['error'], array( 'status' => 400 ) );
		}
		return rest_ensure_response( array( 'ok' => true, 'settings' => self::public_view() ) );
	}
}

/** REST gate: admin-only + per-page nonce issued to that same user. */
function sa_rest_permission() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return new WP_Error( 'forbidden', 'Admins only.', array( 'status' => 403 ) );
	}
	$nonce = isset( $_SERVER['HTTP_X_SA_NONCE'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_SA_NONCE'] ) ) : '';
	if ( ! wp_verify_nonce( $nonce, 'sa_rest' ) ) {
		return new WP_Error( 'bad_nonce', 'Nonce check failed.', array( 'status' => 403 ) );
	}
	return true;
}
