<?php
/**
 * Sourov Agent - chat endpoint + OpenAI-compatible provider call.
 */

class SA_Chat {

	const MAX_MESSAGES = 20;   // sent to the provider per request
	const MAX_CHARS    = 6000; // per message

	/**
	 * Build the system prompt for this request.
	 *
	 * @param string $specialist_id optional persona id
	 * @param string $card_id       optional skill card id
	 */
	public static function build_system_prompt( $specialist_id = '', $card_id = '' ) {
		$name = SA_Settings::get()['greeting_name'] ?: 'there';
		$prompt  = "You are Sourov Agent, the website copilot living inside the wp-admin of " . home_url( '/' ) . ".";
		$prompt .= " The owner's name is {$name}. Answer in the language the user writes in.";
		$prompt .= " Be concrete and prioritized; put commands or code in fenced blocks; when proposing changes, state what you would do and why, plus the risk. Never invent metrics or URLs you were not given - say \"not verified\" instead.";
		if ( $sp = SA_Skills::find_specialist( $specialist_id ) ) {
			$prompt .= "\n\nSPECIALIST PERSONA: " . $sp['persona'];
		}
		if ( $card = SA_Skills::find_card( $card_id ) ) {
			$prompt .= "\n\nACTIVE SKILL CARD (" . $card['title'] . "): " . $card['prompt'];
		}
		$prompt .= "\n\nLIVE SITE CONTEXT (JSON, trusted, generated " . gmdate( 'Y-m-d H:i' ) . " UTC):\n" . SA_Context::system_context_block();
		return $prompt;
	}

	/**
	 * Call the configured provider. Returns [ok, reply, error].
	 */
	public static function call_provider( $messages, $specialist_id = '', $card_id = '' ) {
		$s = SA_Settings::get();
		if ( empty( $s['base_url'] ) || empty( $s['model'] ) ) {
			return array( false, '', 'Provider not configured yet. Open Settings and add your API key, base URL and model.' );
		}
		$key = $s['api_key'];
		if ( $env_key = getenv( 'SA_TEST_KEY' ) ) { // server-side test override only; unset in production
			$key = $env_key;
		}
		if ( empty( $key ) ) {
			return array( false, '', 'No API key saved. Add one in Settings.' );
		}

		$full = array_merge(
			array( array( 'role' => 'system', 'content' => self::build_system_prompt( $specialist_id, $card_id ) ) ),
			array_slice( $messages, -self::MAX_MESSAGES )
		);

		$url = rtrim( $s['base_url'], '/' );
		if ( ! preg_match( '#/v[0-9]+$#', $url ) ) {
			$url .= '/v1'; // tolerate unversioned roots
		}

		$body = wp_json_encode( array(
			'model'       => $s['model'],
			'messages'    => $full,
			'temperature' => (float) $s['temperature'],
			'max_tokens'  => (int) $s['max_tokens'],
		) );

		$resp = wp_remote_post( $url . '/chat/completions', array(
			'timeout' => 180,
			'headers' => array(
				'Content-Type'  => 'application/json',
				'Authorization' => 'Bearer ' . $key,
			),
			'body'    => $body,
		) );

		if ( is_wp_error( $resp ) ) {
			return array( false, '', 'Provider request failed: ' . $resp->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $resp );
		$data = json_decode( wp_remote_retrieve_body( $resp ), true );
		if ( $code !== 200 || empty( $data['choices'][0]['message']['content'] ) ) {
			$detail = '';
			if ( isset( $data['error']['message'] ) && is_string( $data['error']['message'] ) ) {
				$detail = ' ' . mb_substr( $data['error']['message'], 0, 300 );
			} elseif ( isset( $data['error'] ) && is_string( $data['error'] ) ) {
				$detail = ' ' . mb_substr( $data['error'], 0, 300 );
			}
			return array( false, '', 'Provider HTTP ' . $code . '.' . $detail );
		}

		return array( true, $data['choices'][0]['message']['content'], '' );
	}

	/** Sanitize an incoming message array [{role, content}]. */
	public static function sanitize_messages( $in ) {
		if ( ! is_array( $in ) ) {
			return array();
		}
		$out = array();
		foreach ( array_slice( $in, -self::MAX_MESSAGES ) as $m ) {
			if ( ! is_array( $m ) ) {
				continue;
			}
			$role    = in_array( isset( $m['role'] ) ? $m['role'] : '', array( 'user', 'assistant' ), true ) ? $m['role'] : '';
			$content = trim( (string) ( isset( $m['content'] ) ? $m['content'] : '' ) );
			$content = wp_strip_all_tags( $content );
			if ( $role === '' || $content === '' ) {
				continue;
			}
			if ( strlen( $content ) > self::MAX_CHARS ) {
				$content = mb_substr( $content, 0, self::MAX_CHARS ) . '…';
			}
			$out[] = array( 'role' => $role, 'content' => $content );
		}
		return $out;
	}

	public static function handle( $request ) {
		$raw_msgs = $request->get_param( 'messages' );
		$msgs     = self::sanitize_messages( $raw_msgs );
		if ( empty( $msgs ) ) {
			return new WP_Error( 'empty', 'Send at least one message.', array( 'status' => 400 ) );
		}
		$specialist_id = sanitize_key( (string) $request->get_param( 'specialist' ) );
		$card_id       = sanitize_key( (string) $request->get_param( 'skill' ) );

		list( $ok, $reply, $error ) = self::call_provider( $msgs, $specialist_id, $card_id );

		// Persist (skip when the client says save=false, e.g. connection tests)
		$persist = $request->get_param( 'save' ) !== false && $request->get_param( 'save' ) !== 'false';
		$conv_id = (int) $request->get_param( 'conv_id' );
		if ( ! $persist ) {
			$conv_id = 0;
		} elseif ( $conv_id > 0 && get_post_type( $conv_id ) === 'sa_chat' ) {
			// existing conversation: store just this exchange (window already in meta)
			SA_Conversations::append( $conv_id, array_merge( array_slice( $msgs, -1 ), array( array( 'role' => 'assistant', 'content' => $reply ) ) ) );
		} else {
			$conv_id = SA_Conversations::create( mb_substr( $msgs[0]['content'], 0, 80 ), array_slice( array_merge( $msgs, array( array( 'role' => 'assistant', 'content' => $reply ) ) ), -self::MAX_MESSAGES ) );
		}

		return rest_ensure_response( array(
			'ok'        => $ok,
			'reply'     => $reply,
			'error'     => $error,
			'conv_id'   => $conv_id,
			'model'     => $ok ? SA_Settings::get()['model'] : '',
		) );
	}

	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest' ) );
	}

	public static function register_rest() {
		register_rest_route( 'sa/v1', '/chat', array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'          => array( __CLASS__, 'handle' ),
			'permission_callback' => 'sa_rest_permission',
		) );
	}
}
