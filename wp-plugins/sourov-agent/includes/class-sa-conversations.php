<?php
/**
 * Sourov Agent - conversations stored as private posts of CPT 'sa_chat'.
 * post_content is unused; messages live in post meta '_sa_messages'.
 */

class SA_Conversations {

	public static function register_cpt() {
		register_post_type( 'sa_chat', array(
			'labels'       => array( 'name' => 'Agent Chats' ),
			'public'       => false,
			'show_ui'      => false,
			'show_in_menu' => false,
			'supports'     => array( 'title' ),
			'capability_type' => 'post',
			'map_meta'     => true,
		) );
	}

	/** List the latest conversations: [ [id, title, updated] ]. */
	public static function list( $limit = 30 ) {
		$q = get_posts( array(
			'post_type'   => 'sa_chat',
			'post_status' => 'private',
			'numberposts' => min( 50, max( 1, $limit ) ),
			'orderby'     => 'modified',
			'fields'      => 'ids',
		) );
		$out = array();
		foreach ( $q as $id ) {
			$msgs = self::messages( $id );
			$first = '';
			foreach ( $msgs as $m ) {
				if ( 'user' === $m['role'] ) {
					$first = $m['content'];
					break;
				}
			}
			$out[] = array(
				'id'      => (int) $id,
				'title'   => $first !== '' ? mb_substr( $first, 0, 70 ) : get_the_title( $id ),
				'updated' => get_post_modified_time( 'U', true, $id ),
			);
		}
		return $out;
	}

	public static function messages( $id ) {
		$m = get_post_meta( (int) $id, '_sa_messages', true );
		return is_array( $m ) ? $m : array();
	}

	public static function append( $id, $messages ) {
		$cur = self::messages( $id );
		$cur = array_merge( $cur, $messages );
		// keep the conversation bounded: last 60 messages
		if ( count( $cur ) > 60 ) {
			$cur = array_slice( $cur, -60 );
		}
		update_post_meta( (int) $id, '_sa_messages', $cur );
	}

	public static function create( $title, $messages ) {
		$id = wp_insert_post( array(
			'post_type'    => 'sa_chat',
			'post_status'  => 'private',
			'post_title'   => $title !== '' ? mb_substr( $title, 0, 80 ) : 'Untitled',
			'post_content' => '',
		) );
		if ( is_wp_error( $id ) || $id < 1 ) {
			return 0;
		}
		self::append( $id, $messages );
		return (int) $id;
	}

	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_cpt' ), 1 );
		add_action( 'rest_api_init', array( __CLASS__, 'register_rest' ) );
	}

	public static function register_rest() {
		register_rest_route( 'sa/v1', '/conversations', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( __CLASS__, 'rest_list' ), 'permission_callback' => 'sa_rest_permission' ),
		) );
		register_rest_route( 'sa/v1', '/conversations/(?P<id>\d+)', array(
			array( 'methods' => WP_REST_Server::READABLE, 'callback' => array( __CLASS__, 'rest_get' ), 'permission_callback' => 'sa_rest_permission' ),
			array( 'methods' => WP_REST_Server::DELETABLE, 'callback' => array( __CLASS__, 'rest_delete' ), 'permission_callback' => 'sa_rest_permission' ),
		) );
	}

	public static function rest_list() {
		return rest_ensure_response( self::list() );
	}

	public static function rest_get( $request ) {
		$id = (int) $request['id'];
		$p  = get_post( $id );
		if ( ! $p || 'sa_chat' !== $p->post_type ) {
			return new WP_Error( 'not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}
		return rest_ensure_response( array( 'id' => $id, 'messages' => self::messages( $id ) ) );
	}

	public static function rest_delete( $request ) {
		$id = (int) $request['id'];
		$p  = get_post( $id );
		if ( ! $p || 'sa_chat' !== $p->post_type ) {
			return new WP_Error( 'not_found', 'Conversation not found.', array( 'status' => 404 ) );
		}
		wp_delete_post( $id, true );
		return rest_ensure_response( array( 'ok' => true ) );
	}
}
